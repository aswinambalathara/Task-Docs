"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  FileText,
  CheckCircle2,
  Clock,
  CircleDashed,
  Flame,
  ShieldCheck,
  Tag,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useTaskStore, TaskStatus, TaskPriority } from "@/store/useTaskStore"

export function TaskDialog() {
  const [open, setOpen] = React.useState(false)
  const addTask = useTaskStore((state) => state.addTask)

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [status, setStatus] = React.useState<TaskStatus>("todo")
  const [priority, setPriority] = React.useState<TaskPriority>("medium")
  const [date, setDate] = React.useState<Date | undefined>(
    () => new Date(Date.now() + 86400000 * 2)
  )
  const [tagInput, setTagInput] = React.useState("Backend, MCP")
  const [syncToDocs, setSyncToDocs] = React.useState(true)

  const handleSave = () => {
    if (!title.trim()) return

    const parsedTags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      dueDate: date ? date.toISOString() : undefined,
      syncedToDocs: syncToDocs,
      tags: parsedTags.length > 0 ? parsedTags : ["Feature"],
    })

    setOpen(false)
    // Reset form
    setTitle("")
    setDescription("")
    setStatus("todo")
    setPriority("medium")
    setDate(new Date(Date.now() + 86400000 * 2))
    setTagInput("Backend, MCP")
    setSyncToDocs(true)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 shadow-moody-blue-600/20 gap-1.5 bg-linear-to-r px-2.5 py-2 text-xs font-medium text-white shadow-md transition-all sm:px-4 sm:text-sm">
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <DialogContent className="glass-panel border-border/70 flex max-h-[90vh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border p-0 shadow-2xl backdrop-blur-xl sm:w-full sm:max-w-130">
        {/* Fixed Header */}
        <div className="border-border/50 shrink-0 border-b px-5 py-3.5">
          <DialogHeader className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300 rounded-lg p-1">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                Create Dev Task
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground text-sm font-normal">
              Tasks can be tracked locally or auto-synced to Google Docs via MCP.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <div className="min-h-0 flex-1 scrollbar-thin [scrollbar-color:rgba(135,129,211,0.5)_transparent] space-y-3 overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-6">
          {/* Title */}
          <div className="space-y-1">
            <Label
              htmlFor="title"
              className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              Task Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Implement Google Docs batchUpdate handler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-9 rounded-md text-sm font-normal focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label
              htmlFor="desc"
              className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
            >
              Description / Executive Note
            </Label>
            <Textarea
              id="desc"
              rows={2}
              placeholder="Brief summary of what changed or what needs to be implemented..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 min-h-14.5 resize-none rounded-md p-2.5 text-sm leading-relaxed font-normal focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          {/* Priority Segmented Control */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Priority
            </Label>
            <div className="bg-muted/40 dark:bg-muted/20 border-border/60 grid grid-cols-3 gap-1 rounded-xl border p-1">
              {[
                { id: "low", label: "Low", icon: ShieldCheck, color: "text-slate-500" },
                { id: "medium", label: "Medium", icon: Clock, color: "text-amber-500" },
                { id: "high", label: "High", icon: Flame, color: "text-rose-500" },
              ].map((item) => {
                const isSelected = priority === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriority(item.id as TaskPriority)}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all select-none sm:text-sm",
                      isSelected
                        ? "bg-moody-blue-600 font-semibold text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon
                      className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-white" : item.color)}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status Segmented Control */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Initial Status
            </Label>
            <div className="bg-muted/40 dark:bg-muted/20 border-border/60 grid grid-cols-3 gap-1 rounded-xl border p-1">
              {[
                { id: "todo", label: "To Do", icon: CircleDashed },
                { id: "in_progress", label: "In Progress", icon: Clock },
                { id: "done", label: "Done", icon: CheckCircle2 },
              ].map((item) => {
                const isSelected = status === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatus(item.id as TaskStatus)}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all select-none sm:text-sm",
                      isSelected
                        ? "bg-moody-blue-600 font-semibold text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-white" : "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due Date & Tags */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Due Date */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Target Date
              </Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-9 w-full justify-start rounded-md text-left text-sm font-normal focus-visible:ring-1 focus-visible:outline-none",
                        !date && "text-muted-foreground"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="text-moody-blue-500 mr-2 h-3.5 w-3.5" />
                  {date ? format(date, "PPP") : <span>Pick target date</span>}
                </PopoverTrigger>
                <PopoverContent
                  className="glass-panel border-border/80 w-auto rounded-xl border p-0 shadow-xl"
                  align="start"
                >
                  <Calendar mode="single" selected={date} onSelect={setDate} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label
                htmlFor="tags"
                className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
              >
                Tags (comma separated)
              </Label>
              <div className="relative">
                <Tag className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Backend, MCP, Auth"
                  className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-9 rounded-md pl-8 text-sm font-normal focus-visible:ring-1 focus-visible:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sync to Docs Toggle */}
          <div className="bg-moody-blue-500/10 border-moody-blue-500/20 flex items-center justify-between gap-3 rounded-xl border p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText className="text-moody-blue-600 dark:text-moody-blue-400 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-semibold">
                  Sync with Google Docs via MCP
                </p>
                <p className="text-muted-foreground truncate text-xs font-normal">
                  Appends task to engineering log in linked document
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSyncToDocs(!syncToDocs)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                syncToDocs ? "bg-moody-blue-600" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                  syncToDocs ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="border-border/50 bg-muted/20 dark:bg-card/40 flex shrink-0 items-center justify-end gap-2.5 rounded-b-2xl border-t px-5 py-3 backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground h-9 cursor-pointer rounded-md px-4 text-sm font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 shadow-moody-blue-600/20 h-9 cursor-pointer rounded-md bg-linear-to-r px-4.5 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
