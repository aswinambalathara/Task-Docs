from typing import Literal

from loguru import logger

from app.core.config import settings
from app.models.task import Task


class AIService:
    """
    Hybrid AI Summarization & Appraisal Engine powered by Google Gemini 2.0 Flash.
    Provides automated weekly rollups, monthly appraisal dossiers, and deterministic safety nets.
    """

    WEEKLY_INSTRUCTION = (
        "You are an expert engineering leader. Review the developer's weekly contribution logs. "
        "Produce a structured Weekly Rollup with: "
        "1. Key Contributions (bullet points citing project and outcome) "
        "2. Quantified Achievements (count of issues resolved, count of major features/improvements) "
        "3. Key Outcomes (2-3 sentences on tangible business/system impact) "
        "4. Blockers or Carry-Over Work."
    )

    MONTHLY_INSTRUCTION = (
        "You are an executive engineering leader and career appraisal mentor. "
        "Synthesize the developer's monthly contribution records into an audit-proof Performance Appraisal Dossier: "
        "1. Executive Summary & Key Outcomes (tangible value shipped) "
        "2. Technical Areas & Skills Demonstrated (Python, Next.js, Distributed Systems, etc.) "
        "3. Top Challenges Encountered & How They Were Resolved (root cause & engineering decision) "
        "4. Key Technical Learnings & Growth Areas "
        "5. Measurable Metrics (Before vs After impact where available)."
    )

    @classmethod
    def _format_task_context(cls, tasks: list[Task], custom_context: str | None = None) -> str:
        """
        Formats tasks into a clean prompt context adhering to the Contribution -> Outcome -> Evidence spine.
        """
        blocks = []
        if custom_context:
            blocks.append(f"Context / Sprint Objective: {custom_context}\n")

        blocks.append(f"Contributions Logged ({len(tasks)}):")
        for idx, task in enumerate(tasks, 1):
            date_str = task.date.strftime("%b %d")
            entry = [
                f"{idx}. [{date_str}] Project: {task.project} | Area: {task.area or 'N/A'}",
                f"   Contribution: {task.title}",
                f"   Type: {task.type} | Priority: {task.priority} | Status: {task.status}",
            ]
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
        Deterministic Weekly Rollup fallback without external API calls.
        """
        if not tasks:
            return "No contributions logged for this weekly cycle."

        bugs = [t for t in tasks if t.type == "Bug Fix"]
        features = [t for t in tasks if t.type in ["Feature", "Improvement"]]

        lines = [
            "### 📅 WEEKLY SUMMARY",
            f"**Week Contributions:** {len(tasks)} total | **Issues Resolved:** {len(bugs)} | **Improvements/Features:** {len(features)}\n",
            "**Key Contributions:**",
        ]
        for t in tasks[:5]:
            outcome_text = f" → {t.outcome}" if t.outcome else ""
            evidence_text = f" ({t.evidence})" if t.evidence else ""
            lines.append(f"• [{t.project}] {t.title}{outcome_text}{evidence_text}")

        lines.append("\n**Key Outcomes:**")
        lines.append("• Shipped verified technical improvements across active repository branches.")
        lines.append("• Resolved priority defects and updated integration workflows.")

        lines.append("\n**Blockers & Carry-over:**")
        lines.append("• Monitor newly deployed workflows and verify edge cases in production.")

        return "\n".join(lines)

    @classmethod
    def deterministic_monthly_dossier(cls, tasks: list[Task]) -> str:
        """
        Deterministic Monthly Appraisal Dossier fallback.
        """
        if not tasks:
            return "No contributions logged for this monthly appraisal period."

        projects = sorted(list({t.project for t in tasks if t.project}))
        types = sorted(list({t.type for t in tasks}))

        lines = [
            "### 🏆 MONTHLY APPRAISAL DOSSIER",
            f"**Active Projects:** {', '.join(projects)} | **Total Logged Accomplishments:** {len(tasks)}\n",
            "**1. Key Outcomes & Shipped Value:**",
        ]
        for t in tasks[:6]:
            outcome = t.outcome or "Completed technical milestone with tests"
            lines.append(f"• {t.title}: {outcome}")

        lines.append("\n**2. Technical Areas & Categories Worked On:**")
        lines.append(f"• {', '.join(types)}")

        lines.append("\n**3. Challenges Overcome & Engineering Decisions:**")
        lines.append(
            "• Resolved integration and edge-case exceptions through structured reproduction and testing."
        )
        lines.append("• Refactored decoupled service boundaries to eliminate technical debt.")

        lines.append("\n**4. Key Learnings:**")
        lines.append(
            "• Strengthened knowledge of robust service contracts and asynchronous execution."
        )
        lines.append(
            "• Improved documentation of verifiable evidence for architectural milestones."
        )

        return "\n".join(lines)

    @classmethod
    async def generate_summary(
        cls,
        tasks: list[Task],
        api_key: str | None = None,
        custom_context: str | None = None,
        mode: Literal["weekly", "monthly"] = "weekly",
    ) -> tuple[str, Literal["gemini-2.0-flash", "deterministic_fallback"]]:
        """
        Synthesizes tasks into an executive summary or appraisal dossier using Gemini 2.0 Flash.
        Falls back seamlessly to deterministic generation if API key is missing or call fails.
        """
        if not tasks:
            return "No tasks to summarize.", "deterministic_fallback"

        effective_key = api_key or settings.GEMINI_API_KEY
        if not effective_key:
            logger.info("No Gemini API key provided. Using deterministic fallback summary.")
            if mode == "monthly":
                return cls.deterministic_monthly_dossier(tasks), "deterministic_fallback"
            return cls.deterministic_weekly_summary(tasks), "deterministic_fallback"

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=effective_key)
            prompt_content = cls._format_task_context(tasks, custom_context)
            system_instruction = (
                cls.MONTHLY_INSTRUCTION if mode == "monthly" else cls.WEEKLY_INSTRUCTION
            )

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    max_output_tokens=350,
                    temperature=0.2,
                ),
            )

            if response.text and response.text.strip():
                return response.text.strip(), "gemini-2.0-flash"

            logger.warning(
                "Empty response from Gemini 2.0 Flash, falling back to deterministic template."
            )
            if mode == "monthly":
                return cls.deterministic_monthly_dossier(tasks), "deterministic_fallback"
            return cls.deterministic_weekly_summary(tasks), "deterministic_fallback"

        except Exception as exc:
            logger.error(
                f"Gemini 2.0 Flash generation failed ({exc}). Falling back to deterministic template."
            )
            if mode == "monthly":
                return cls.deterministic_monthly_dossier(tasks), "deterministic_fallback"
            return cls.deterministic_weekly_summary(tasks), "deterministic_fallback"
