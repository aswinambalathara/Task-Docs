"use client"

import * as React from "react"
import { useReducedMotion, type TargetAndTransition, type Transition } from "framer-motion"

import { cn } from "@/lib/utils"

// Every illustration plays on the same loop length, so the steps feel like one piece
export const CYCLE_SECONDS = 6

// Looping animation props for a motion element. Under prefers-reduced-motion the element
// renders `still` (one representative frame) and never moves.
export function useLoop() {
  const reduceMotion = useReducedMotion()
  return React.useCallback(
    (frames: TargetAndTransition, still: TargetAndTransition, transition: Transition = {}) =>
      reduceMotion
        ? { initial: false as const, animate: still }
        : {
            // Start on the first keyframe, so a delayed loop doesn't flash at a default position
            initial: Object.fromEntries(
              Object.entries(frames).map(([key, value]) => [
                key,
                Array.isArray(value) ? value[0] : value,
              ])
            ) as TargetAndTransition,
            animate: frames,
            transition: {
              duration: CYCLE_SECONDS,
              ease: "easeInOut" as const,
              repeat: Infinity,
              ...transition,
            },
          },
    [reduceMotion]
  )
}

// An id usable inside url(#...): React ids contain characters that break the reference
export function useSvgId(prefix: string) {
  return `${prefix}-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
}

export function IllustrationFrame({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg
      viewBox="0 0 360 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={cn("h-auto w-full max-w-105 select-none", className)}
    >
      {children}
    </svg>
  )
}

// A small task card: two placeholder text lines and a status dot
export function MiniCard({
  x,
  y,
  width = 84,
  height = 30,
  dotClassName = "fill-status-todo",
  className = "stroke-border",
}: {
  x: number
  y: number
  width?: number
  height?: number
  dotClassName?: string
  className?: string
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        className={cn("fill-card", className)}
        strokeWidth={1.25}
      />
      <circle cx={x + 10} cy={y + 10} r={3} className={dotClassName} />
      <rect
        x={x + 18}
        y={y + 7}
        width={width * 0.55}
        height={6}
        rx={3}
        className="fill-muted-foreground/40"
      />
      <rect x={x + 10} y={y + 18} width={width * 0.4} height={5} rx={2.5} className="fill-muted" />
    </g>
  )
}

// Points of a five-pointed star centered on 0,0 (outer radius 12)
export const STAR_POINTS =
  "0,-12 2.94,-4.05 11.41,-3.71 4.76,1.55 7.05,9.71 0,5 -7.05,9.71 -4.76,1.55 -11.41,-3.71 -2.94,-4.05"
