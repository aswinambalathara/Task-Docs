import asyncio
from collections import Counter
from typing import Literal

from loguru import logger

from app.core.config import settings
from app.models.task import Task
from app.services.ai.prompts import MONTHLY_INSTRUCTION, WEEKLY_INSTRUCTION

STATUS_LABELS = {
    "done": "Done",
    "in_progress": "In progress",
    "todo": "To do",
    "blocked": "Blocked",
    "cancelled": "Cancelled",
}

# Overload and rate-limit errors are usually brief, so retry each model before moving on
RETRYABLE_CODES = {429, 500, 503}
GEMINI_ATTEMPTS = 2
GEMINI_RETRY_DELAY_S = 3

# Fallback lists stay short enough to scan
MAX_FALLBACK_ITEMS = 8


def _bullets(items: list[str], limit: int = MAX_FALLBACK_ITEMS) -> list[str]:
    """Bullet lines for items, ending with a count of what was left out."""
    if not items:
        return ["None"]
    lines = [f"• {item}" for item in items[:limit]]
    if len(items) > limit:
        lines.append(f"• …and {len(items) - limit} more")
    return lines


def _projects(tasks: list[Task]) -> list[str]:
    return sorted({t.project for t in tasks if t.project})


def _label(task: Task, show_project: bool) -> str:
    return f"{task.title} ({task.project})" if show_project else task.title


class AIService:
    """
    Writes weekly summaries and monthly dossiers with Google Gemini, falling back to a
    deterministic template that only restates what was logged.
    """

    @classmethod
    def totals_line(cls, tasks: list[Task]) -> str:
        """Status counts for a period, e.g. '13 done · 12 in progress · 2 planned · 5 bug fixes shipped'."""
        counts = Counter(t.status for t in tasks)
        bugs_shipped = sum(1 for t in tasks if t.type == "Bug Fix" and t.status == "done")
        parts = [
            f"{counts['done']} done",
            f"{counts['in_progress']} in progress",
            f"{counts['todo']} planned",
        ]
        if counts["blocked"]:
            parts.append(f"{counts['blocked']} blocked")
        parts.append(f"{bugs_shipped} bug fix{'es' if bugs_shipped != 1 else ''} shipped")
        return " · ".join(parts)

    @classmethod
    def _format_task_context(cls, tasks: list[Task], custom_context: str | None = None) -> str:
        """
        Formats tasks into a clean prompt context adhering to the Contribution -> Outcome -> Evidence spine.
        """
        blocks = []
        if custom_context:
            blocks.append(f"Context / Sprint Objective: {custom_context}\n")

        blocks.append(f"Totals: {cls.totals_line(tasks)} · projects: {', '.join(_projects(tasks))}")
        blocks.append(f"Contributions Logged ({len(tasks)}):")
        for idx, task in enumerate(tasks, 1):
            date_str = task.date.strftime("%b %d")
            status = STATUS_LABELS.get(task.status, task.status)
            entry = [
                f"{idx}. [{date_str}] Project: {task.project} | Area: {task.area or 'N/A'}",
                f"   Contribution: {task.title}",
                f"   Type: {task.type} | Priority: {task.priority} | Status: {status}",
            ]
            if task.is_career_highlight:
                entry.append("   Career highlight: yes")
            if task.description:
                entry.append(f"   Details: {task.description}")
            if task.outcome:
                entry.append(f"   Outcome: {task.outcome}")
            if task.evidence:
                entry.append(f"   Evidence: {task.evidence}")
            if task.requested_by:
                entry.append(f"   Requested By: {task.requested_by}")
            if task.contributions:
                notes = "; ".join([c.note for c in task.contributions])
                entry.append(f"   Notes: {notes}")
            blocks.append("\n".join(entry))

        return "\n\n".join(blocks)

    @classmethod
    def deterministic_weekly_summary(cls, tasks: list[Task]) -> str:
        """
        Weekly summary without external API calls: lists logged work by status, invents nothing.
        """
        if not tasks:
            return "No contributions logged for this weekly cycle."

        projects = _projects(tasks)
        multi = len(projects) > 1

        def titles(status: str) -> list[str]:
            return [_label(t, multi) for t in tasks if t.status == status]

        lines = [
            "Week at a glance",
            f"{len(tasks)} contribution(s) logged on {', '.join(projects) or 'General'}.",
            "",
            "Shipped",
            *_bullets(titles("done")),
            "",
            "In progress",
            *_bullets(titles("in_progress")),
            "",
            "Up next",
            *_bullets(titles("todo")),
        ]
        if blocked := titles("blocked"):
            lines += ["", "Blockers", *_bullets(blocked)]
        lines += ["", "By the numbers", cls.totals_line(tasks)]
        return "\n".join(lines)

    @classmethod
    def deterministic_monthly_dossier(cls, tasks: list[Task]) -> str:
        """
        Monthly summary without external API calls: highlights and carry-over from the logs only.
        """
        if not tasks:
            return "No contributions logged for this monthly appraisal period."

        projects = _projects(tasks)
        multi = len(projects) > 1
        done = [t for t in tasks if t.status == "done"]
        # Starred work first, then by priority
        rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        done.sort(key=lambda t: (not t.is_career_highlight, rank.get(t.priority, 4)))
        highlights = [
            f"{_label(t, multi)}: {t.outcome}" if t.outcome else _label(t, multi) for t in done
        ]
        carried = [
            f"{_label(t, multi)} ({STATUS_LABELS[t.status].lower()})"
            for t in tasks
            if t.status in ("in_progress", "todo", "blocked")
        ]

        lines = [
            "Month at a glance",
            f"{len(tasks)} contribution(s) logged on {', '.join(projects) or 'General'}.",
            "",
            "Highlights",
            *_bullets(highlights, limit=6),
            "",
            "Carried into next month",
            *_bullets(carried),
            "",
            "By the numbers",
            f"{cls.totals_line(tasks)} · projects: {', '.join(projects) or 'General'}",
        ]
        return "\n".join(lines)

    @classmethod
    def deterministic_yearly_summary(cls, tasks: list[Task], year: int) -> str:
        """Year-end rollup from the logs: per-project counts and starred work."""
        if not tasks:
            return f"No contributions logged in {year}."

        months = len({t.date.month for t in tasks})
        per_project = Counter(t.project or "General" for t in tasks)
        done_per_project = Counter(t.project or "General" for t in tasks if t.status == "done")
        project_lines = [
            f"{name}: {count} contribution(s), {done_per_project[name]} done"
            for name, count in per_project.most_common()
        ]
        starred = [
            f"{t.title} ({t.date.strftime('%b')})"
            for t in sorted(tasks, key=lambda t: t.date)
            if t.is_career_highlight
        ]

        lines = [
            f"{len(tasks)} contribution(s) logged across {months} month(s) in {year}.",
            "",
            "Projects",
            *_bullets(project_lines),
        ]
        if starred:
            lines += ["", "Career highlights", *_bullets(starred, limit=12)]
        lines += ["", "By the numbers", cls.totals_line(tasks)]
        return "\n".join(lines)

    @classmethod
    def _fallback(cls, tasks: list[Task], mode: Literal["weekly", "monthly"]) -> str:
        if mode == "monthly":
            return cls.deterministic_monthly_dossier(tasks)
        return cls.deterministic_weekly_summary(tasks)

    @classmethod
    async def generate_summary(
        cls,
        tasks: list[Task],
        api_key: str | None = None,
        custom_context: str | None = None,
        mode: Literal["weekly", "monthly"] = "weekly",
    ) -> tuple[str, str]:
        """
        Writes a weekly summary or monthly dossier with Gemini; returns the text and the model
        that wrote it. Falls back to the deterministic template ("deterministic_fallback") if no
        API key is set or every model in settings.GEMINI_MODELS fails.
        """
        if not tasks:
            return "No tasks to summarize.", "deterministic_fallback"

        effective_key = api_key or settings.GEMINI_API_KEY
        if not effective_key:
            logger.info("No Gemini API key provided. Using deterministic fallback summary.")
            return cls._fallback(tasks, mode), "deterministic_fallback"

        try:
            from google import genai
            from google.genai import errors as genai_errors, types

            client = genai.Client(api_key=effective_key)
            config = types.GenerateContentConfig(
                system_instruction=MONTHLY_INSTRUCTION if mode == "monthly" else WEEKLY_INSTRUCTION,
                # Thinking tokens count against the output limit, so leave room for both
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
                max_output_tokens=4096,
                temperature=0.2,
            )
            prompt_content = cls._format_task_context(tasks, custom_context)

            async def call(model_name: str) -> types.GenerateContentResponse:
                for attempt in range(GEMINI_ATTEMPTS):
                    try:
                        # Async client: a slow Gemini call must not block the event loop
                        return await client.aio.models.generate_content(
                            model=model_name, contents=prompt_content, config=config
                        )
                    except genai_errors.APIError as api_exc:
                        if api_exc.code not in RETRYABLE_CODES or attempt == GEMINI_ATTEMPTS - 1:
                            raise
                        logger.info(f"Gemini model {model_name} busy ({api_exc.code}); retrying")
                        await asyncio.sleep(GEMINI_RETRY_DELAY_S * (attempt + 1))
                raise RuntimeError("unreachable")

            for model_name in settings.GEMINI_MODELS:
                try:
                    response = await call(model_name)
                    finish = response.candidates[0].finish_reason if response.candidates else None
                    if finish == types.FinishReason.MAX_TOKENS:
                        logger.warning(f"Gemini model {model_name} hit the output limit; trying next")
                        continue
                    if response.text and response.text.strip():
                        return response.text.strip(), model_name
                    logger.warning(f"Gemini model {model_name} returned no text (finish: {finish})")
                except Exception as model_exc:
                    logger.warning(f"Gemini model {model_name} failed: {model_exc}")

            logger.warning(f"All Gemini models failed for the {mode} summary; using the fallback template.")
            return cls._fallback(tasks, mode), "deterministic_fallback"

        except Exception as exc:
            logger.error(f"Gemini summary generation failed ({exc}). Using the fallback template.")
            return cls._fallback(tasks, mode), "deterministic_fallback"
