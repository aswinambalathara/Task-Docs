import type * as React from "react"

import { DocsIllustration } from "./illustrations/docs-illustration"
import { DoneIllustration } from "./illustrations/done-illustration"
import { HubIllustration } from "./illustrations/hub-illustration"
import { IdeIllustration } from "./illustrations/ide-illustration"
import { KanbanIllustration } from "./illustrations/kanban-illustration"
import { StarIllustration } from "./illustrations/star-illustration"

export interface OnboardingStep {
  id: string
  eyebrow: string
  title: string
  description: string
  points: string[]
  illustration: React.ComponentType
  // Opens the real setup page for this step (onboarding itself only explains)
  action?: { label: string; href: string }
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    eyebrow: "Welcome to Tethr",
    title: "Your work, tethered to your impact",
    description:
      "Tethr keeps a running record of what you ship. Log tasks yourself or let your AI IDE do it, and Tethr writes them into a Google Doc you can bring to your next review.",
    points: [
      "Track tasks and contribution notes in one place",
      "Log work straight from Cursor, Claude, Windsurf or Antigravity",
      "Sync it all into a Google Docs impact ledger",
    ],
    illustration: HubIllustration,
  },
  {
    id: "tasks",
    eyebrow: "Track your work",
    title: "Every task, in the view that suits you",
    description:
      "Add tasks from the dashboard and move them through To do, In progress, Done or Blocked as the work happens.",
    points: [
      "Switch between table, board and grid views",
      "Add projects, tags and outcomes so the context isn't lost",
      "Search and filter to find anything later",
    ],
    illustration: KanbanIllustration,
  },
  {
    id: "highlights",
    eyebrow: "Star your wins",
    title: "Mark the work worth remembering",
    description:
      "Star a task to make it a career highlight. When review season comes, your best work is already collected.",
    points: [
      "One click on the star marks a highlight",
      "Filter the dashboard to highlights only",
      "Your assistant can star tasks for you over MCP",
    ],
    illustration: StarIllustration,
  },
  {
    id: "ide",
    eyebrow: "Connect your AI IDE",
    title: "Let your assistant log the work for you",
    description:
      "Tethr is an MCP server. Once your IDE is authorized, your assistant can add and update tasks while you code. Just ask it.",
    points: [
      "Copy the config snippet for your IDE from Settings",
      "Approve the connection once on the authorization screen",
      "Tools: add_task, update_task, get_tasks and sync_docs",
    ],
    illustration: IdeIllustration,
    action: { label: "Set up your IDE", href: "/settings" },
  },
  {
    id: "docs",
    eyebrow: "Sync to Google Docs",
    title: "An impact ledger that writes itself",
    description:
      "Connect Google and pick a document. Tethr keeps its daily table up to date and can add weekly and monthly summaries.",
    points: [
      "Choose real-time, end-of-day or weekly table updates",
      "Turn on weekly and monthly summaries",
      "Manual syncs are limited each week, so automatic sync does most of the work",
    ],
    illustration: DocsIllustration,
    action: { label: "Connect Google Docs", href: "/settings" },
  },
  {
    id: "done",
    eyebrow: "You're all set",
    title: "Finish setting up, then get to work",
    description:
      "Here's where your workspace stands. You can replay this tour any time from Settings.",
    points: [],
    illustration: DoneIllustration,
  },
]
