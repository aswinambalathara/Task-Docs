"use client"

import * as React from "react"
import { CalendarDays, X } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DATE_PRESETS,
  presetRange,
  rangeLabel,
  type DatePreset,
  type DayRange,
} from "@/lib/date-range"
import { cn } from "@/lib/utils"

interface DateRangeFilterProps {
  preset: DatePreset
  range: DayRange | null
  onChange: (preset: DatePreset, range: DayRange | null) => void
}

export function DateRangeFilter({ preset, range, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = React.useState(false)
  // A custom range is picked in two clicks; hold the first one here until the second
  const [draft, setDraft] = React.useState<{ from: Date } | undefined>()
  const isActive = preset !== "all"

  const pickPreset = (key: DatePreset) => {
    onChange(key, presetRange(key))
    setDraft(undefined)
    setOpen(false)
  }

  return (
    <div className="relative flex shrink-0 items-center">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setDraft(undefined)
        }}
      >
        <PopoverTrigger
          className={cn(
            "border-border flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition-colors",
            isActive
              ? "bg-primary-soft text-foreground border-primary/40 pr-8"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="Show tasks worked on in a date range: work date, completion or a logged note"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{rangeLabel(preset, range)}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="border-border flex flex-row flex-wrap gap-1 border-b p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => pickPreset(p.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    preset === p.key
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="p-1">
              <Calendar
                mode="range"
                selected={draft ?? (range ? { from: range.from, to: range.to } : undefined)}
                onSelect={(_, day) => {
                  if (!draft?.from) {
                    setDraft({ from: day })
                    return
                  }
                  const [from, to] = day < draft.from ? [day, draft.from] : [draft.from, day]
                  onChange("custom", { from, to })
                  setDraft(undefined)
                  setOpen(false)
                }}
                defaultMonth={range?.from}
                weekStartsOn={1}
              />
              <p className="text-muted-foreground px-3 pb-2 text-[11px]">
                {draft?.from ? "Pick the last day" : "Pick a day, then the last day of the range"}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {isActive && (
        <button
          onClick={() => pickPreset("all")}
          className="text-muted-foreground hover:text-foreground absolute right-2 rounded p-0.5"
          title="Clear date filter"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
