import * as React from "react"
import { cn } from "@/lib/utils"

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked" | "cancelled" | string

interface StatusBadgeProps {
  status: TaskStatus
  className?: string
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string; strike?: boolean }
> = {
  todo: {
    label: "To do",
    bg: "bg-status-todo/10",
    text: "text-status-todo",
    dot: "bg-status-todo",
  },
  in_progress: {
    label: "In progress",
    bg: "bg-status-progress/10",
    text: "text-status-progress",
    dot: "bg-status-progress",
  },
  done: {
    label: "Done",
    bg: "bg-status-done/10",
    text: "text-status-done",
    dot: "bg-status-done",
  },
  blocked: {
    label: "Blocked",
    bg: "bg-status-blocked/10",
    text: "text-status-blocked",
    dot: "bg-status-blocked",
  },
  cancelled: {
    label: "Cancelled",
    bg: "bg-status-cancelled/10",
    text: "text-status-cancelled",
    dot: "bg-status-cancelled",
    strike: true,
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "todo").toLowerCase().replace("-", "_")
  const config = statusConfig[normalized] || statusConfig.todo

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium select-none shrink-0",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} aria-hidden="true" />
      <span className={config.strike ? "line-through" : ""}>{config.label}</span>
    </span>
  )
}
