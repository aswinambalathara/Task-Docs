"""
Core system and role template constants for Tethr.
"""

from typing import Literal

DEVELOPER_TASK_TYPES = (
    "Feature",
    "Bug Fix",
    "Improvement",
    "Investigation",
    "Research / POC",
    "Performance",
    "Infrastructure",
    "AI / LLM",
    "UI / UX",
    "Data",
)

DeveloperTaskType = Literal[
    "Feature",
    "Bug Fix",
    "Improvement",
    "Investigation",
    "Research / POC",
    "Performance",
    "Infrastructure",
    "AI / LLM",
    "UI / UX",
    "Data",
]

# Length limits for fields logged over MCP. Outcome and Evidence are table cells in the
# Google Doc, so agents must keep them short and put the full story in `description`.
OUTCOME_MAX_CHARS = 160
EVIDENCE_MAX_CHARS = 120
DESCRIPTION_MAX_CHARS = 2000

# Longest text shown in one Google Doc table cell; longer values (typed in the web app) are
# cut with an ellipsis in the Doc only, the stored task keeps the full text
DOC_CELL_MAX_CHARS = 200
