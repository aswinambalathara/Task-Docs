import * as React from "react"
import { cn } from "@/lib/utils"

interface TypeBadgeProps {
  type: string
  className?: string
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium select-none shrink-0",
        className
      )}
    >
      {type || "Task"}
    </span>
  )
}
