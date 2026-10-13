"use client"

import * as React from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SimpleSelectOption<T extends string> {
  value: T
  label: React.ReactNode
}

interface SimpleSelectProps<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: SimpleSelectOption<T>[]
  id?: string
  "aria-label"?: string
  size?: "sm" | "default"
  className?: string
}

// Themed dropdown for a fixed list of string options; a drop-in for a native <select>,
// whose popup the browser draws in its own (unthemed) style.
export function SimpleSelect<T extends string>({
  value,
  onValueChange,
  options,
  id,
  "aria-label": ariaLabel,
  size = "default",
  className,
}: SimpleSelectProps<T>) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as T)
      }}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn("w-full cursor-pointer bg-card font-medium", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="cursor-pointer">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
