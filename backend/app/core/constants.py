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
