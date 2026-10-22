from app.core.constants import DOC_CELL_MAX_CHARS
from app.models.task import Task
from app.services.docs.renderer import (
    DAILY_TABLE_COLUMNS,
    DAILY_TABLE_FONT_PT,
    bullet_requests,
    compact_summary,
    daily_table_layout_requests,
    daily_table_row,
    doc_cell_text,
    is_summary_title,
    landscape_request,
    landscape_table_width,
)

LETTER_PORTRAIT = {
    "pageSize": {"width": {"magnitude": 612, "unit": "PT"}, "height": {"magnitude": 792, "unit": "PT"}},
    "marginLeft": {"magnitude": 72, "unit": "PT"},
    "marginRight": {"magnitude": 72, "unit": "PT"},
}


def test_column_shares_fill_the_table():
    assert sum(share for _, share in DAILY_TABLE_COLUMNS) == 100
    assert len(DAILY_TABLE_COLUMNS) == 10


def test_doc_cell_text_keeps_short_values_and_collapses_whitespace():
    assert doc_cell_text("PR #142,\n  commit eb05be0d") == "PR #142, commit eb05be0d"
    assert doc_cell_text(None) == "—"
    assert doc_cell_text("   ") == "—"
    assert doc_cell_text(None, empty="General") == "General"


def test_doc_cell_text_cuts_long_values_at_a_word_with_an_ellipsis():
    long_outcome = "Root-caused a recurring prod-only UI regression " * 10
    cell = doc_cell_text(long_outcome)

    assert len(cell) <= DOC_CELL_MAX_CHARS
    assert cell.endswith("…")
    # Cut between words, never mid-word
    assert long_outcome.startswith(cell[:-1])
    assert long_outcome[len(cell) - 1] == " "


def test_portrait_page_is_turned_landscape_keeping_the_paper_size():
    request = landscape_request(LETTER_PORTRAIT)

    page = request["updateDocumentStyle"]["documentStyle"]["pageSize"]
    assert page["width"]["magnitude"] == 792
    assert page["height"]["magnitude"] == 612
    assert request["updateDocumentStyle"]["fields"] == "pageSize"


def test_landscape_page_is_left_alone():
    landscape = {
        **LETTER_PORTRAIT,
        "pageSize": {"width": {"magnitude": 792}, "height": {"magnitude": 612}},
    }
    assert landscape_request(landscape) is None


def test_table_width_uses_the_long_side_minus_margins():
    assert landscape_table_width(LETTER_PORTRAIT) == 792 - 144
    # No page setup reported: falls back to US Letter with 1" margins
    assert landscape_table_width({}) == 792 - 144


def test_layout_requests_size_columns_and_style_text_after_insertion():
    # Two cells as they sit before text is inserted: header "Date" at 5, a row cell at 9
    cells = [(0, 5, "Date"), (1, 9, "Oct 14")]
    requests = daily_table_layout_requests(table_start=2, cells=cells, table_width=648)

    widths = [r["updateTableColumnProperties"] for r in requests if "updateTableColumnProperties" in r]
    assert len(widths) == len(DAILY_TABLE_COLUMNS)
    assert all(w["tableColumnProperties"]["widthType"] == "FIXED_WIDTH" for w in widths)
    total = sum(w["tableColumnProperties"]["width"]["magnitude"] for w in widths)
    assert abs(total - 648) < 1

    text_styles = [r["updateTextStyle"] for r in requests if "updateTextStyle" in r]
    header, row = text_styles
    assert header["range"] == {"startIndex": 5, "endIndex": 9}
    assert header["textStyle"]["bold"] is True
    # The second cell moved right by the 4 characters inserted before it
    assert row["range"] == {"startIndex": 13, "endIndex": 19}
    assert row["textStyle"]["fontSize"]["magnitude"] == DAILY_TABLE_FONT_PT
    assert "bold" not in row["textStyle"]


def test_daily_table_row_shortens_free_text_and_labels_status():
    task = Task(
        user_id="user_test",
        title="Hotfix prod sidebar regression",
        project="Chordian",
        status="in_progress",
        priority="high",
        outcome="x " * 300,
        evidence=None,
    )
    row = daily_table_row(task)

    assert len(row) == len(DAILY_TABLE_COLUMNS)
    assert row[7] == "In progress"
    assert len(row[8]) <= DOC_CELL_MAX_CHARS and row[8].endswith("…")
    assert row[9] == "—"
    assert row[6] == "Self-initiated"


def test_bullet_requests_group_adjacent_lines_and_delete_prefixes_back_to_front():
    # Two adjacent bullets, then a heading at 30-40, then one more bullet
    reqs = bullet_requests([(50, 60), (10, 20), (20, 30)])

    creates = [r["createParagraphBullets"]["range"] for r in reqs if "createParagraphBullets" in r]
    assert creates == [{"startIndex": 10, "endIndex": 29}, {"startIndex": 50, "endIndex": 59}]

    # Bullets first (no index shift), then deletions from the end so earlier indices hold
    deletes = [r["deleteContentRange"]["range"] for r in reqs if "deleteContentRange" in r]
    assert reqs.index({"deleteContentRange": {"range": deletes[0]}}) == len(creates)
    assert deletes == [
        {"startIndex": 50, "endIndex": 52},
        {"startIndex": 20, "endIndex": 22},
        {"startIndex": 10, "endIndex": 12},
    ]


def test_summary_titles_and_compaction():
    assert is_summary_title("Weekly Summary — Week 2")
    assert is_summary_title("October Monthly Summary")
    assert is_summary_title("2026 Annual Engineering Summary")
    assert not is_summary_title("Shipped")
    assert compact_summary("Shipped\n• A\n\n\nIn progress\n  \n• B") == "Shipped\n• A\nIn progress\n• B"
