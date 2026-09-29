import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, viewportClassName, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
        <div
          className={cn(
            "h-full w-full overflow-x-hidden overflow-y-auto scroll-smooth",
            "scrollbar-thin",
            "[scrollbar-color:var(--border)_transparent]",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30",
            "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50",
            "[&::-webkit-scrollbar-button]:hidden",
            "[&::-webkit-scrollbar-button]:size-0",
            viewportClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
