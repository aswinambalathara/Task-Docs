import * as React from "react"
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

export type TaskPriority = "low" | "medium" | "high" | "urgent" | string

interface PriorityIndicatorProps {
  priority: TaskPriority
  showLabel?: boolean
  className?: string
}

const priorityConfig: Record<
  string,
  {
    label: string
    colorClass: string
    icon: React.ComponentType<{ className?: string }>
    isUrgent?: boolean
  }
> = {
  low: {
    label: "Low",
    colorClass: "text-priority-low",
    icon: ArrowDown,
  },
  medium: {
    label: "Medium",
    colorClass: "text-priority-medium",
    icon: ArrowRight,
  },
  high: {
    label: "High",
    colorClass: "text-priority-high",
    icon: ArrowUp,
  },
  urgent: {
    label: "Urgent",
    colorClass: "text-priority-urgent",
    icon: AlertTriangle,
    isUrgent: true,
  },
}

export function PriorityIndicator({
  priority,
  showLabel = true,
  className,
}: PriorityIndicatorProps) {
  const normalized = (priority || "medium").toLowerCase()
  const config = priorityConfig[normalized] || priorityConfig.medium
  const Icon = config.icon

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs select-none", className)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", config.colorClass)} aria-hidden="true" />
      {showLabel && <span className="text-muted-foreground font-medium">{config.label}</span>}
    </span>
  )
}
