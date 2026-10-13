import * as React from "react"
import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, viewportClassName, ...props }, ref) => {
    return (
      // Flex column + min-h-0: the viewport is bounded by this element's height or max-height.
      // With only `h-full`, a max-height parent left the viewport at its content height, so
      // overflow was clipped instead of scrolled.
      <div ref={ref} className={cn("relative flex min-h-0 flex-col overflow-hidden", className)} {...props}>
        <div
          className={cn(
            "min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scroll-smooth",
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
