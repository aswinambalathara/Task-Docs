import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "bg-transparent border border-input rounded-md flex min-h-20 w-full px-3 py-2 text-sm placeholder:text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
