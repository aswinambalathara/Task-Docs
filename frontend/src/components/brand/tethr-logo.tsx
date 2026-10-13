import * as React from "react"

import { cn } from "@/lib/utils"

// The Tethr mark: contribution and outcome nodes tethered down to an evidence anchor,
// forming a "T". Same geometry as app/icon.svg (the favicon).
export function TethrLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  // Unique per instance, so several logos on one page don't share a gradient id
  const gradientId = React.useId()

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tethr"
      className={cn("h-8 w-8 shrink-0", className)}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path d="M9 11H23M16 11V19.5" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="9" cy="11" r="2.75" fill="#fff" />
      <circle cx="23" cy="11" r="2.75" fill="#fff" />
      <circle cx="16" cy="22.5" r="3" stroke="#fff" strokeWidth="2.25" />
    </svg>
  )
}
