"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface CareerStarProps {
  isStarred: boolean
  onToggle: (e: React.MouseEvent) => void
  disabled?: boolean
  className?: string
}

export function CareerStar({
  isStarred,
  onToggle,
  disabled = false,
  className,
}: CareerStarProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      whileTap={shouldReduceMotion ? undefined : { scale: 1.25 }}
      transition={{ duration: 0.15 }}
      onClick={onToggle}
      disabled={disabled}
      aria-label={isStarred ? "Remove career highlight" : "Mark as career highlight"}
      aria-pressed={isStarred}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        isStarred
          ? "text-highlight"
          : "text-muted-foreground/40 hover:text-highlight/70",
        className
      )}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-transform",
          isStarred && "fill-highlight"
        )}
        aria-hidden="true"
      />
    </motion.button>
  )
}
