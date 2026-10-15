import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  setHours,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns"

import type { Task } from "@/store/useTaskStore"

export type DatePreset =
  "all" | "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "custom"

// Inclusive local days
export interface DayRange {
  from: Date
  to: Date
}

export const DATE_PRESETS: { key: Exclude<DatePreset, "custom">; label: string }[] = [
  { key: "all", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "this_month", label: "This month" },
]

// Weeks run Monday to Sunday, like the weekly summaries in the Google Doc
export function presetRange(preset: DatePreset, now = new Date()): DayRange | null {
  switch (preset) {
    case "today":
      return { from: now, to: now }
    case "yesterday": {
      const day = subDays(now, 1)
      return { from: day, to: day }
    }
    case "this_week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case "last_7_days":
      return { from: subDays(now, 6), to: now }
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) }
    default:
      return null
  }
}

export function rangeLabel(preset: DatePreset, range: DayRange | null): string {
  if (preset !== "custom") return DATE_PRESETS.find((p) => p.key === preset)?.label ?? "Any time"
  if (!range) return "Any time"
  if (isSameDay(range.from, range.to)) return format(range.from, "MMM d")
  return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`
}

// Same rule as the API's date filter: work date, completion or a logged contribution in range.
// Creation and edits don't count, so backdated tasks land on their work date.
export function isActiveInRange(task: Task, range: DayRange): boolean {
  const start = startOfDay(range.from).getTime()
  const end = endOfDay(range.to).getTime()
  const inRange = (iso?: string) => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= start && t <= end
  }
  return (
    inRange(task.date) ||
    inRange(task.completedAt) ||
    task.contributions.some((c) => inRange(c.loggedAt))
  )
}

// A picked day as a work date: now for today, else local noon, which stays on the same
// calendar date in UTC (the Google Doc table groups rows by UTC date)
export function toWorkDate(day: Date): Date {
  return isToday(day) ? new Date() : setHours(startOfDay(day), 12)
}
