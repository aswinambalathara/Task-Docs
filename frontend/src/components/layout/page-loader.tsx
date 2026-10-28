import { TethrLogo } from "@/components/brand/tethr-logo"
import { cn } from "@/lib/utils"

// Full-area placeholder shown while a page or its auth state is still loading
export function PageLoader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[calc(100vh-8rem)] flex-1 flex-col items-center justify-center px-4 py-16",
        className
      )}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="bg-primary/30 absolute -inset-5 animate-pulse rounded-full blur-xl" />
        <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full [animation-duration:2s]" />
        <div className="border-primary/20 border-t-primary absolute inset-0 animate-spin rounded-full border-2" />
        <TethrLogo className="relative h-9 w-9 animate-pulse" aria-hidden />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
