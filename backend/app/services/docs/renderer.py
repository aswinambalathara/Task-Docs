"""
Builds the ledger document in Google Docs: the daily table, weekly summaries and monthly
dossiers, laid out by the user's cadence rules.
"""

import asyncio
import calendar
import re
from datetime import UTC, date, datetime, timedelta
from typing import Any

from googleapiclient.discovery import build
from loguru import logger

from app.core.constants import DOC_CELL_MAX_CHARS
from app.models.integration import Integration, SyncCadence
from app.models.task import Task
from app.services.ai.prompts import MONTHLY_SECTIONS, WEEKLY_SECTIONS
from app.services.ai.summarizer import AIService
from app.services.docs import periods

# Sub-headings inside summaries, bolded like the other section titles
SUMMARY_HEADINGS = {*WEEKLY_SECTIONS, *MONTHLY_SECTIONS, "Projects", "Career highlights"}

# Per-user render lock: two concurrent full re-renders would interleave their
# delete/insert requests and corrupt the document. (Process-local.)
render_locks: dict[str, asyncio.Lock] = {}


WEEKDAY_MAP = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def clean_markdown_for_docs(text: str) -> str:
    """
    Cleans markdown headers, bold/italic markers, and formatting artifacts
    so Google Docs displays clean, readable executive text instead of raw ### and **.
    """
    if not text:
        return ""
    # Remove header markers like '### ' or '## '
    cleaned = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    # Remove bold markers like '**Text**' -> 'Text'
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    # Remove italic markers like '*Text*' -> 'Text'
    cleaned = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", cleaned)
    # Standardize bullet markers like '- ' or '* ' -> '• '
    cleaned = re.sub(r"^\s*[-*]\s+", "• ", cleaned, flags=re.MULTILINE)
    # Remove lingering markdown code fences
    cleaned = re.sub(r"```[a-zA-Z]*\n?", "", cleaned)
    # Remove raw markdown pipe table lines if any leaked into text summaries
    cleaned = re.sub(r"^\|.*\|$", "", cleaned, flags=re.MULTILINE)
    # Clean excessive blank lines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# --- Daily table layout ---------------------------------------------------------------------

# Columns of the daily contribution table, with each one's share of the table width (sums to
# 100). Short fixed values get narrow columns; the free-text ones get the room.
DAILY_TABLE_COLUMNS: list[tuple[str, int]] = [
    ("Date", 7),
    ("Project", 8),
    ("Area", 8),
    ("Contribution", 17),
    ("Type", 8),
    ("Priority", 8),
    ("Requested By", 9),
    ("Status", 8),
    ("Outcome", 15),
    ("Evidence", 12),
]
DAILY_TABLE_FONT_PT = 9

STATUS_LABELS = {
    "todo": "To do",
    "in_progress": "In progress",
    "done": "Done",
    "blocked": "Blocked",
    "cancelled": "Cancelled",
}

# US Letter with 1" margins, used when the document doesn't report its own page setup
DEFAULT_PAGE = {"width": 612.0, "height": 792.0, "margin": 72.0}


def doc_cell_text(value: str | None, limit: int = DOC_CELL_MAX_CHARS, empty: str = "—") -> str:
    """
    Text for one table cell: whitespace collapsed onto one line, and cut at a word boundary
    with an ellipsis when longer than `limit`. Only the Doc is shortened; the task keeps the
    full text.
    """
    if not value or not value.strip():
        return empty
    text = " ".join(value.split())
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,;:.-") + "…"


def _magnitude(style: dict, *path: str, default: float) -> float:
    node: Any = style
    for key in path:
        node = node.get(key, {}) if isinstance(node, dict) else {}
    value = node.get("magnitude") if isinstance(node, dict) else None
    return float(value) if value else default


def landscape_request(document_style: dict) -> dict | None:
    """
    An updateDocumentStyle request that turns a portrait page sideways (keeping its paper
    size), or None when the page is already landscape. Ten columns don't fit on portrait.
    """
    width = _magnitude(document_style, "pageSize", "width", default=DEFAULT_PAGE["width"])
    height = _magnitude(document_style, "pageSize", "height", default=DEFAULT_PAGE["height"])
    if width >= height:
        return None
    return {
        "updateDocumentStyle": {
            "documentStyle": {
                "pageSize": {
                    "width": {"magnitude": height, "unit": "PT"},
                    "height": {"magnitude": width, "unit": "PT"},
                }
            },
            "fields": "pageSize",
        }
    }


def landscape_table_width(document_style: dict) -> float:
    """Width available to a table once the page is landscape: the long side minus margins."""
    width = _magnitude(document_style, "pageSize", "width", default=DEFAULT_PAGE["width"])
    height = _magnitude(document_style, "pageSize", "height", default=DEFAULT_PAGE["height"])
    left = _magnitude(document_style, "marginLeft", default=DEFAULT_PAGE["margin"])
    right = _magnitude(document_style, "marginRight", default=DEFAULT_PAGE["margin"])
    return max(width, height) - left - right


def _utf16_len(text: str) -> int:
    # Docs API indexes count UTF-16 code units, not Python characters
    return len(text.encode("utf-16-le")) // 2


def daily_table_layout_requests(
    table_start: int,
    cells: list[tuple[int, int, str]],
    table_width: float,
) -> list[dict]:
    """
    Requests that size the daily table's columns and set its font, sent in the same
    batchUpdate right after the cell text is inserted.

    `cells` holds (row, start index before insertion, text) for every cell; the text ranges
    are worked out as they will be once all of the text has been inserted.
    """
    requests: list[dict] = []
    for column, (_, share) in enumerate(DAILY_TABLE_COLUMNS):
        requests.append({
            "updateTableColumnProperties": {
                "tableStartLocation": {"index": table_start},
                "columnIndices": [column],
                "tableColumnProperties": {
                    "widthType": "FIXED_WIDTH",
                    "width": {"magnitude": round(table_width * share / 100, 1), "unit": "PT"},
                },
                "fields": "widthType,width",
            }
        })

    # Inserting text shifts every later cell, so walk the cells in document order
    shift = 0
    for row, start, text in sorted(cells, key=lambda cell: cell[1]):
        length = _utf16_len(text)
        if length:
            text_style: dict[str, Any] = {"fontSize": {"magnitude": DAILY_TABLE_FONT_PT, "unit": "PT"}}
            fields = "fontSize"
            if row == 0:
                text_style["bold"] = True
                fields = "fontSize,bold"
            requests.append({
                "updateTextStyle": {
                    "range": {"startIndex": start + shift, "endIndex": start + shift + length},
                    "textStyle": text_style,
                    "fields": fields,
                }
            })
        shift += length
    return requests


def daily_table_row(task: Task) -> list[str]:
    """One task as the cells of a daily table row, in DAILY_TABLE_COLUMNS order."""
    return [
        task.date.strftime("%b %d"),
        doc_cell_text(task.project, empty="General"),
        doc_cell_text(task.area),
        doc_cell_text(task.title),
        task.type or "Feature",
        task.priority.upper() if task.priority else "MEDIUM",
        doc_cell_text(task.requested_by, empty="Self-initiated"),
        STATUS_LABELS.get(task.status, task.status.capitalize()) if task.status else "Done",
        doc_cell_text(task.outcome),
        doc_cell_text(task.evidence),
    ]


def insert_native_daily_table(
    service,
    document_id: str,
    tasks: list[Task],
    insert_index: int = 1,
) -> None:
    """
    Inserts a structured, beautifully styled Google Docs Native Table (10 columns)
    with Dark Slate header background, bold white text, and zebra-striped rows.
    """
    if not tasks:
        return

    headers = [
        "Date", "Project", "Area", "Contribution", "Type",
        "Priority", "Requested By", "Status", "Outcome", "Evidence"
    ]
    rows_data = [headers]
    for t in tasks:
        date_str = t.date.strftime("%b %d")
        rows_data.append([
            date_str,
            t.project or "General",
            t.area or "—",
            t.title or "—",
            t.type or "Feature",
            t.priority.upper() if t.priority else "MEDIUM",
            t.requested_by or "—",
            t.status.capitalize() if t.status else "Done",
            t.outcome or "—",
            t.evidence or "—",
        ])

    num_rows = len(rows_data)
    num_cols = len(headers)

    # 1. Insert empty table structure
    service.documents().batchUpdate(
        documentId=document_id,
        body={
            "requests": [
                {
                    "insertTable": {
                        "rows": num_rows,
                        "columns": num_cols,
                        "location": {"index": insert_index},
                    }
                }
            ]
        },
    ).execute()

    # 2. Retrieve document to locate the inserted table
    doc = service.documents().get(documentId=document_id).execute()
    table_el = None
    for el in doc.get("body", {}).get("content", []):
        if "table" in el and abs(el.get("startIndex", 0) - insert_index) < 60:
            table_el = el
            break

    if not table_el:
        for el in doc.get("body", {}).get("content", []):
            if "table" in el:
                table_el = el
                break

    if not table_el:
        logger.warning(f"Could not locate inserted table at index {insert_index}")
        return

    t_start = table_el["startIndex"]
    table_rows = table_el["table"]["tableRows"]

    # 3. Collect cell startIndices and values
    cells_to_fill = []
    for r_idx, row in enumerate(table_rows):
        if r_idx >= len(rows_data):
            break
        for c_idx, cell in enumerate(row["tableCells"]):
            if c_idx >= len(rows_data[r_idx]):
                break
            start = cell["content"][0]["startIndex"]
            val = str(rows_data[r_idx][c_idx])
            cells_to_fill.append((start, val))

    # Sort reverse by start index so earlier cell indices don't shift!
    cells_to_fill.sort(key=lambda x: x[0], reverse=True)
    populate_requests = []
    for start, val in cells_to_fill:
        populate_requests.append({
            "insertText": {
                "location": {"index": start},
                "text": val,
            }
        })

    # Style Header Row (Dark Slate Background #1E293B)
    populate_requests.append({
        "updateTableCellStyle": {
            "tableRange": {
                "tableCellLocation": {
                    "tableStartLocation": {"index": t_start},
                    "rowIndex": 0,
                    "columnIndex": 0,
                },
                "rowSpan": 1,
                "columnSpan": num_cols,
            },
            "tableCellStyle": {
                "backgroundColor": {
                    "color": {"rgbColor": {"red": 0.12, "green": 0.16, "blue": 0.24}}
                }
            },
            "fields": "backgroundColor",
        }
    })

    # Style Zebra stripes for alternate data rows (#F8FAFC)
    for r_idx in range(1, len(table_rows)):
        if r_idx % 2 == 0:
            populate_requests.append({
                "updateTableCellStyle": {
                    "tableRange": {
                        "tableCellLocation": {
                            "tableStartLocation": {"index": t_start},
                            "rowIndex": r_idx,
                            "columnIndex": 0,
                        },
                        "rowSpan": 1,
                        "columnSpan": num_cols,
                    },
                    "tableCellStyle": {
                        "backgroundColor": {
                            "color": {"rgbColor": {"red": 0.97, "green": 0.98, "blue": 0.99}}
                        }
                    },
                    "fields": "backgroundColor",
                }
            })

    service.documents().batchUpdate(
        documentId=document_id, body={"requests": populate_requests}
    ).execute()

    # 4. Bold white font on header cells and compact typography on data cells
    try:
        doc2 = service.documents().get(documentId=document_id).execute()
        for el in doc2.get("body", {}).get("content", []):
            if "table" in el and abs(el.get("startIndex", 0) - t_start) < 30:
                text_styles = []
                table_rows_res = el["table"]["tableRows"]
                # Row 0: Bold white 9pt font
                if table_rows_res:
                    for cell in table_rows_res[0]["tableCells"]:
                        for p in cell.get("content", []):
                            c_start = p.get("startIndex")
                            c_end = p.get("endIndex")
                            if c_start is not None and c_end is not None and c_end > c_start + 1:
                                text_styles.append({
                                    "updateTextStyle": {
                                        "range": {"startIndex": c_start, "endIndex": c_end - 1},
                                        "textStyle": {
                                            "bold": True,
                                            "foregroundColor": {
                                                "color": {"rgbColor": {"red": 1.0, "green": 1.0, "blue": 1.0}}
                                            },
                                            "fontSize": {"magnitude": 9, "unit": "PT"},
                                        },
                                        "fields": "bold,foregroundColor,fontSize",
                                    }
                                })
                # Rows 1..N: Clean 8.5pt text, Slate-700
                for r_i in range(1, len(table_rows_res)):
                    for cell in table_rows_res[r_i]["tableCells"]:
                        for p in cell.get("content", []):
                            c_start = p.get("startIndex")
                            c_end = p.get("endIndex")
                            if c_start is not None and c_end is not None and c_end > c_start + 1:
                                text_styles.append({
                                    "updateTextStyle": {
                                        "range": {"startIndex": c_start, "endIndex": c_end - 1},
                                        "textStyle": {
                                            "foregroundColor": {
                                                "color": {"rgbColor": {"red": 0.2, "green": 0.25, "blue": 0.33}}
                                            },
                                            "fontSize": {"magnitude": 8.5, "unit": "PT"},
                                        },
                                        "fields": "foregroundColor,fontSize",
                                    }
                                })
                if text_styles:
                    service.documents().batchUpdate(
                        documentId=document_id, body={"requests": text_styles}
                    ).execute()
                break
    except Exception as style_exc:
        logger.warning(f"Could not apply table text styling: {style_exc}")


def get_month_calendar_weeks(year: int, month: int) -> list[dict[str, Any]]:
    """Monday-to-Sunday calendar weeks of a month (see periods)."""
    return periods.month_calendar_weeks(year, month)


def should_render_weekly_summary(
    week: dict[str, Any],
    cadence: SyncCadence | None,
    cadence_type: str,
    today: date,
    has_cached_summary: bool = False,
    is_target_week: bool = False,
) -> bool:
    """
    Determines whether a weekly summary should be included in the document:
    - Always included if explicitly requested manually (cadence_type in ["weekly_summary", "all"])
      for the active/target week.
    - Always preserved if a summary was already generated and cached.
    - If automated, only included if cadence.weekly_enabled is True AND:
      - The week has concluded (today > week['end_date']), OR
      - For the current week, today is on or after the user's preferred weekday (e.g. Friday/Saturday/Sunday).
    - If cadence.weekly_enabled is False, excluded unless manually generated/cached.
    """
    if cadence_type in ["weekly_summary", "all"] and is_target_week:
        return True
    if has_cached_summary:
        return True
    if cadence and not cadence.weekly_enabled:
        return False

    if today > week["end_date"]:
        return True
    if today < week["start_date"]:
        return False

    raw_day = cadence.weekly_day if cadence and cadence.weekly_day else "Saturday"
    weekly_day = raw_day.strip().capitalize()
    target_wd = WEEKDAY_MAP.get(weekly_day, 5)

    preferred_date = None
    cur = week["start_date"]
    while cur <= week["end_date"]:
        if cur.weekday() == target_wd:
            preferred_date = cur
            break
        cur += timedelta(days=1)

    if preferred_date is None:
        preferred_date = week["end_date"]

    return today >= preferred_date


def should_render_monthly_summary(
    year: int,
    month: int,
    cadence: SyncCadence | None,
    cadence_type: str,
    today: date,
    has_cached_summary: bool = False,
    is_target_month: bool = False,
) -> bool:
    """
    Determines whether the monthly summary section (narrative + 2-col table + learnings) should be included:
    - Always included if explicitly requested manually (cadence_type in ["monthly_dossier", "all"])
      for the active/target month.
    - Always preserved if a summary was already generated and cached.
    - If automated, only included if cadence.monthly_enabled is True AND:
      - The month has completed in the past, OR
      - Today is on or after the final calendar day of the month.
    - If cadence.monthly_enabled is False, excluded unless manually generated/cached.
    """
    if cadence_type in ["monthly_dossier", "all"] and is_target_month:
        return True
    if has_cached_summary:
        return True
    if cadence and not cadence.monthly_enabled:
        return False

    if year < today.year or (year == today.year and month < today.month):
        return True
    if year > today.year or (year == today.year and month > today.month):
        return False

    _, last_day = calendar.monthrange(year, month)
    end_of_month = date(year, month, last_day)
    return today >= end_of_month


def render_structured_ledger_document(
    service,
    document_id: str,
    tasks: list[Task],
    weekly_summary: str | None = None,
    monthly_dossier: str | None = None,
    cadence_type: str = "all",
    cadence: SyncCadence | None = None,
    cached_summaries: dict[str, str] | None = None,
    today: date | None = None,
    target_year: int | None = None,
    target_month: int | None = None,
    target_week_num: int | None = None,
) -> None:
    """
    Renders or refreshes the entire Google Doc to match the exact template specification
    defined in Tethr_Task_Documentation_January_2026.docx:
    - Tethr — Task Documentation
    - Year: YYYY
    - Documentation of Month MMMM (DD/MM/YYYY – DD/MM/YYYY)
    - DAILY CONTRIBUTION LOG — Week N with 10-column native table (#D9EAF7 headers, zebra stripes)
    - Weekly Summary — Week N (added on user preferred date or manual request)
    - MMMM Monthly Summary (added at end of month or manual request)
    - Key Contributions 2-column table (Area | Major Contribution)
    - Annual Engineering Summary at year boundaries (per-project counts and career highlights)

    Idempotent: Clears existing document body first so repeated syncs never duplicate tables.
    """
    if today is None:
        today = datetime.now(UTC).date()
    if target_year is None:
        target_year = today.year
    if target_month is None:
        target_month = today.month

    # 1. Clear existing document body
    doc = service.documents().get(documentId=document_id).execute()
    content = doc.get("body", {}).get("content", [])
    if content:
        end_idx = content[-1]["endIndex"] - 1
        if end_idx > 1:
            service.documents().batchUpdate(
                documentId=document_id,
                body={"requests": [{"deleteContentRange": {"range": {"startIndex": 1, "endIndex": end_idx}}}]},
            ).execute()

    # Landscape page, so the 10-column daily table has room
    document_style = doc.get("documentStyle", {})
    table_width = landscape_table_width(document_style)
    orientation = landscape_request(document_style)
    if orientation:
        service.documents().batchUpdate(
            documentId=document_id, body={"requests": [orientation]}
        ).execute()

    # 2. Insert Root Title
    root_title = "Tethr — Task Documentation\n"
    service.documents().batchUpdate(
        documentId=document_id,
        body={"requests": [{"insertText": {"location": {"index": 1}, "text": root_title}}]},
    ).execute()

    # 3. Group tasks by Year -> Month
    now = datetime.now(UTC)
    tasks_by_year: dict[int, dict[int, list[Task]]] = {}
    for t in tasks:
        y = t.date.year
        m = t.date.month
        if y not in tasks_by_year:
            tasks_by_year[y] = {}
        if m not in tasks_by_year[y]:
            tasks_by_year[y][m] = []
        tasks_by_year[y][m].append(t)

    if not tasks_by_year:
        tasks_by_year[now.year] = {now.month: []}

    # 4. Iterate through Years and Months
    for year in sorted(tasks_by_year.keys()):
        cur_doc = service.documents().get(documentId=document_id).execute()
        cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
        year_heading = f"Year: {year}\n"
        service.documents().batchUpdate(
            documentId=document_id,
            body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": year_heading}}]},
        ).execute()

        for month in sorted(tasks_by_year[year].keys()):
            m_tasks = tasks_by_year[year][month]
            _, last_m_day = calendar.monthrange(year, month)
            month_name = calendar.month_name[month]
            m_start_str = date(year, month, 1).strftime("%d/%m/%Y")
            m_end_str = date(year, month, last_m_day).strftime("%d/%m/%Y")

            cur_doc = service.documents().get(documentId=document_id).execute()
            cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
            month_heading = f"Documentation of Month {month_name} ({m_start_str} – {m_end_str})\n\n"
            service.documents().batchUpdate(
                documentId=document_id,
                body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": month_heading}}]},
            ).execute()

            cal_weeks = get_month_calendar_weeks(year, month)
            for w in cal_weeks:
                w_tasks = [
                    t for t in m_tasks
                    if t.date.date() >= w["start_date"] and t.date.date() <= w["end_date"]
                ]
                if not w_tasks:
                    continue

                # Insert Weekly Contribution Section Heading
                cur_doc = service.documents().get(documentId=document_id).execute()
                cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
                week_header = f"DAILY CONTRIBUTION LOG — Week {w['week_num']}\n{w['start_str']} to {w['end_str']}\n"
                service.documents().batchUpdate(
                    documentId=document_id,
                    body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": week_header}}]},
                ).execute()

                # Insert 10-column Native Table
                cur_doc = service.documents().get(documentId=document_id).execute()
                t_idx = cur_doc["body"]["content"][-1]["endIndex"] - 1

                headers = [header for header, _ in DAILY_TABLE_COLUMNS]
                rows_data = [headers] + [daily_table_row(t) for t in w_tasks]

                num_rows = len(rows_data)
                num_cols = len(headers)
                service.documents().batchUpdate(
                    documentId=document_id,
                    body={"requests": [{"insertTable": {"rows": num_rows, "columns": num_cols, "location": {"index": t_idx}}}]},
                ).execute()

                # Populate Table Cells
                cur_doc = service.documents().get(documentId=document_id).execute()
                t_el = None
                for el in cur_doc["body"]["content"]:
                    if "table" in el and abs(el.get("startIndex", 0) - t_idx) < 35:
                        t_el = el
                        break

                if t_el:
                    t_start = t_el["startIndex"]
                    cells_to_fill = []
                    layout_cells = []
                    for r_idx, r in enumerate(t_el["table"]["tableRows"]):
                        for c_idx, c in enumerate(r["tableCells"]):
                            val = str(rows_data[r_idx][c_idx])
                            start = c["content"][0]["startIndex"]
                            cells_to_fill.append((start, val))
                            layout_cells.append((r_idx, start, val))
                    cells_to_fill.sort(key=lambda x: x[0], reverse=True)
                    fill_reqs = [{"insertText": {"location": {"index": s}, "text": v}} for s, v in cells_to_fill]
                    # Column widths and a smaller font, so long cells don't stack a word per line
                    fill_reqs.extend(daily_table_layout_requests(t_start, layout_cells, table_width))

                    # Header style: Soft Corporate Blue (#D9EAF7)
                    fill_reqs.append({
                        "updateTableCellStyle": {
                            "tableRange": {
                                "tableCellLocation": {"tableStartLocation": {"index": t_start}, "rowIndex": 0, "columnIndex": 0},
                                "rowSpan": 1,
                                "columnSpan": num_cols,
                            },
                            "tableCellStyle": {
                                "backgroundColor": {"color": {"rgbColor": {"red": 0.85, "green": 0.92, "blue": 0.97}}},
                            },
                            "fields": "backgroundColor",
                        }
                    })
                    # Zebra striping on alternate rows (#F8FAFC)
                    for r_i in range(1, num_rows):
                        if r_i % 2 == 0:
                            fill_reqs.append({
                                "updateTableCellStyle": {
                                    "tableRange": {
                                        "tableCellLocation": {"tableStartLocation": {"index": t_start}, "rowIndex": r_i, "columnIndex": 0},
                                        "rowSpan": 1,
                                        "columnSpan": num_cols,
                                    },
                                    "tableCellStyle": {
                                        "backgroundColor": {"color": {"rgbColor": {"red": 0.97, "green": 0.98, "blue": 0.99}}},
                                    },
                                    "fields": "backgroundColor",
                                }
                            })
                    service.documents().batchUpdate(documentId=document_id, body={"requests": fill_reqs}).execute()

                # Insert Weekly Summary conditionally based on schedule preference or manual request
                week_key = f"weekly:{year}:{month}:{w['week_num']}"
                has_cached_w = bool(cached_summaries and week_key in cached_summaries)
                is_target_w = (
                    year == target_year
                    and month == target_month
                    and (target_week_num is None or w["week_num"] == target_week_num)
                )

                include_week_summary = should_render_weekly_summary(
                    week=w,
                    cadence=cadence,
                    cadence_type=cadence_type,
                    today=today,
                    has_cached_summary=has_cached_w,
                    is_target_week=is_target_w,
                )
                if include_week_summary:
                    cur_doc = service.documents().get(documentId=document_id).execute()
                    cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
                    if weekly_summary and is_target_w:
                        w_summary_content = clean_markdown_for_docs(weekly_summary)
                    elif cached_summaries and week_key in cached_summaries:
                        w_summary_content = clean_markdown_for_docs(cached_summaries[week_key])
                    else:
                        w_summary_content = AIService.deterministic_weekly_summary(w_tasks)

                    week_summary_block = (
                        f"\nWeekly Summary — Week {w['week_num']}\n"
                        f"{w_summary_content}\n\n"
                    )
                    service.documents().batchUpdate(
                        documentId=document_id,
                        body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": week_summary_block}}]},
                    ).execute()

            # Month-End Summary Section conditionally based on end of month or manual request
            month_key = f"monthly:{year}:{month}"
            has_cached_m = bool(cached_summaries and month_key in cached_summaries)
            is_target_m = (year == target_year and month == target_month)

            include_month_summary = should_render_monthly_summary(
                year=year,
                month=month,
                cadence=cadence,
                cadence_type=cadence_type,
                today=today,
                has_cached_summary=has_cached_m,
                is_target_month=is_target_m,
            )
            if include_month_summary:
                cur_doc = service.documents().get(documentId=document_id).execute()
                cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
                if monthly_dossier and is_target_m:
                    m_intro = clean_markdown_for_docs(monthly_dossier)
                elif cached_summaries and month_key in cached_summaries:
                    m_intro = clean_markdown_for_docs(cached_summaries[month_key])
                else:
                    m_intro = AIService.deterministic_monthly_dossier(m_tasks)

                month_summary_block = (
                    f"{month_name} Monthly Summary\n"
                    f"{m_intro}\n\n"
                    "Key Contributions\n"
                )
                service.documents().batchUpdate(
                    documentId=document_id,
                    body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": month_summary_block}}]},
                ).execute()

                # Insert Key Contributions 2-Column Table (Area | Major Contribution)
                area_contributions: dict[str, list[str]] = {}
                for t in m_tasks:
                    a = t.area or "General"
                    if a not in area_contributions:
                        area_contributions[a] = []
                    if t.title and t.title not in area_contributions[a]:
                        area_contributions[a].append(t.title)

                kc_rows = [["Area", "Major Contribution"]]
                if area_contributions:
                    for a_name, titles in area_contributions.items():
                        kc_rows.append([a_name, "; ".join(titles[:3])])
                else:
                    kc_rows.append(["Platform Engineering", "Core feature delivery and sprint maintenance."])

                cur_doc = service.documents().get(documentId=document_id).execute()
                kc_idx = cur_doc["body"]["content"][-1]["endIndex"] - 1
                service.documents().batchUpdate(
                    documentId=document_id,
                    body={"requests": [{"insertTable": {"rows": len(kc_rows), "columns": 2, "location": {"index": kc_idx}}}]}
                ).execute()

                # Populate Key Contributions Table
                cur_doc = service.documents().get(documentId=document_id).execute()
                kc_el = None
                for el in cur_doc["body"]["content"]:
                    if "table" in el and abs(el.get("startIndex", 0) - kc_idx) < 35:
                        kc_el = el
                        break

                if kc_el:
                    kc_start = kc_el["startIndex"]
                    kc_cells = []
                    for r_i, r in enumerate(kc_el["table"]["tableRows"]):
                        for c_i, c in enumerate(r["tableCells"]):
                            val = str(kc_rows[r_i][c_i])
                            start = c["content"][0]["startIndex"]
                            kc_cells.append((start, val))
                    kc_cells.sort(key=lambda x: x[0], reverse=True)
                    kc_reqs = [{"insertText": {"location": {"index": s}, "text": v}} for s, v in kc_cells]
                    kc_reqs.append({
                        "updateTableCellStyle": {
                            "tableRange": {
                                "tableCellLocation": {"tableStartLocation": {"index": kc_start}, "rowIndex": 0, "columnIndex": 0},
                                "rowSpan": 1,
                                "columnSpan": 2,
                            },
                            "tableCellStyle": {
                                "backgroundColor": {"color": {"rgbColor": {"red": 0.85, "green": 0.92, "blue": 0.97}}},
                            },
                            "fields": "backgroundColor",
                        }
                    })
                    service.documents().batchUpdate(documentId=document_id, body={"requests": kc_reqs}).execute()

                # Blank line after the table so the next section doesn't touch it
                cur_doc = service.documents().get(documentId=document_id).execute()
                cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
                service.documents().batchUpdate(
                    documentId=document_id,
                    body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": "\n"}}]}
                ).execute()

        # End of Year Summary if year has concluded or today is Dec 31
        if year < today.year or (year == today.year and today.month == 12 and today.day >= 31):
            cur_doc = service.documents().get(documentId=document_id).execute()
            cur_end = cur_doc["body"]["content"][-1]["endIndex"] - 1
            year_tasks = [t for month_tasks in tasks_by_year[year].values() for t in month_tasks]
            annual_summary = (
                f"{year} Annual Engineering Summary\n"
                f"{AIService.deterministic_yearly_summary(year_tasks, year)}\n\n"
            )
            service.documents().batchUpdate(
                documentId=document_id,
                body={"requests": [{"insertText": {"location": {"index": cur_end}, "text": annual_summary}}]}
            ).execute()

    # 5. Apply Typography & Heading Formatting
    try:
        doc_styled = service.documents().get(documentId=document_id).execute()
        style_reqs = []
        for el in doc_styled.get("body", {}).get("content", []):
            if "paragraph" in el:
                p_text = "".join(
                    [tr.get("textRun", {}).get("content", "") for tr in el["paragraph"].get("elements", [])]
                ).strip()
                p_start = el.get("startIndex")
                p_end = el.get("endIndex")
                if not p_text or not p_start or not p_end or p_end <= p_start + 1:
                    continue

                if p_text == "Tethr — Task Documentation":
                    style_reqs.append({
                        "updateTextStyle": {
                            "range": {"startIndex": p_start, "endIndex": p_end - 1},
                            "textStyle": {"bold": True, "fontSize": {"magnitude": 15, "unit": "PT"}},
                            "fields": "bold,fontSize",
                        }
                    })
                elif p_text.startswith("Year:") or p_text.startswith("Documentation of Month"):
                    style_reqs.append({
                        "updateTextStyle": {
                            "range": {"startIndex": p_start, "endIndex": p_end - 1},
                            "textStyle": {"bold": True, "fontSize": {"magnitude": 11, "unit": "PT"}},
                            "fields": "bold,fontSize",
                        }
                    })
                elif (
                    "DAILY CONTRIBUTION LOG" in p_text
                    or "Monthly Summary" in p_text
                    or p_text.endswith("Annual Engineering Summary")
                ):
                    style_reqs.append({
                        "updateTextStyle": {
                            "range": {"startIndex": p_start, "endIndex": p_end - 1},
                            "textStyle": {
                                "bold": True,
                                "fontSize": {"magnitude": 12, "unit": "PT"},
                                "foregroundColor": {"color": {"rgbColor": {"red": 0.12, "green": 0.16, "blue": 0.24}}},
                            },
                            "fields": "bold,fontSize,foregroundColor",
                        }
                    })
                elif (
                    "Weekly Summary" in p_text
                    or p_text == "Key Contributions"
                    or p_text in SUMMARY_HEADINGS
                ):
                    style_reqs.append({
                        "updateTextStyle": {
                            "range": {"startIndex": p_start, "endIndex": p_end - 1},
                            "textStyle": {
                                "bold": True,
                                "fontSize": {"magnitude": 11, "unit": "PT"},
                                "foregroundColor": {"color": {"rgbColor": {"red": 0.12, "green": 0.16, "blue": 0.24}}},
                            },
                            "fields": "bold,fontSize,foregroundColor",
                        }
                    })

        if style_reqs:
            service.documents().batchUpdate(documentId=document_id, body={"requests": style_reqs}).execute()
    except Exception as style_err:
        logger.warning(f"Could not apply heading styles: {style_err}")


def build_daily_contribution_log_table(tasks: list[Task]) -> str:
    """
    Builds the markdown Daily Contribution Log table following the exact vision from documentation structure plan:
    | Date | Project | Area | Contribution | Type | Priority | Requested By | Status | Outcome | Evidence |
    """
    lines = [
        "### 📋 DAILY CONTRIBUTION LOG",
        "| Date | Project | Area | Contribution | Type | Priority | Requested By | Status | Outcome | Evidence |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for t in tasks:
        date_str = t.date.strftime("%b %d")
        area_str = t.area or "—"
        req_str = t.requested_by or "—"
        outcome_str = doc_cell_text(t.outcome)
        evidence_str = doc_cell_text(t.evidence)
        status_str = t.status.capitalize()
        lines.append(
            f"| {date_str} | {t.project} | {area_str} | {t.title} | {t.type} | {t.priority.upper()} | {req_str} | {status_str} | {outcome_str} | {evidence_str} |"
        )
    return "\n".join(lines)


def build_full_sync_document_text(
    tasks: list[Task],
    weekly_summary: str | None = None,
    monthly_dossier: str | None = None,
    cadence_type: str = "all",
) -> str:
    """
    Assembles structured sections for Google Docs insertion based on requested cadence.
    """
    now_str = datetime.now(UTC).strftime("%B %d, %Y - %H:%M UTC")
    blocks = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🚀 TETHR CONTRIBUTION & IMPACT UPDATE — {now_str}",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
    ]

    if cadence_type in ["monthly_dossier", "all"] and monthly_dossier:
        blocks.append(monthly_dossier)
        blocks.append("\n" + "─" * 60 + "\n")

    if cadence_type in ["weekly_summary", "all"] and weekly_summary:
        blocks.append(weekly_summary)
        blocks.append("\n" + "─" * 60 + "\n")

    if cadence_type in ["daily_table", "all"] and tasks:
        blocks.append(build_daily_contribution_log_table(tasks))

    blocks.append("\n\n")
    return "\n".join(blocks)


async def render_document(
    integration: Integration,
    credentials: Any,
    tasks: list[Task],
    period: periods.TargetPeriod,
    today: date,
    cadence_type: str,
    weekly_summary: str | None = None,
    monthly_dossier: str | None = None,
) -> None:
    # The Google client is blocking and the render makes many API calls, so it runs
    # on a worker thread to keep the event loop (and every other request) responsive.
    service = await asyncio.to_thread(
        build, "docs", "v1", credentials=credentials, cache_discovery=False
    )
    await asyncio.to_thread(
        render_structured_ledger_document,
        service=service,
        document_id=integration.target_doc_id,
        tasks=tasks,
        weekly_summary=weekly_summary,
        monthly_dossier=monthly_dossier,
        cadence_type=cadence_type,
        cadence=integration.cadence,
        cached_summaries=integration.cached_summaries,
        today=today,
        target_year=period.year,
        target_month=period.month,
        target_week_num=period.week_num,
    )
