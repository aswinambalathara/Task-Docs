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
  AlertTriangle,
  Flame,
  ShieldCheck,
  Tag
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
    new Date(Date.now() + 86400000 * 2)
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
          <Button className="bg-linear-to-r from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 text-white shadow-md shadow-moody-blue-600/20 font-medium px-2.5 sm:px-4 py-2 gap-1.5 transition-all text-xs sm:text-sm">
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Task</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-130 max-h-[90vh] flex flex-col p-0 rounded-2xl glass-panel border border-border/70 shadow-2xl backdrop-blur-xl overflow-hidden gap-0">
        {/* Fixed Header */}
        <div className="px-5 py-3.5 border-b border-border/50 shrink-0">
          <DialogHeader className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight">Create Dev Task</DialogTitle>
            </div>
            <DialogDescription className="text-sm font-normal text-muted-foreground">
              Tasks can be tracked locally or auto-synced to Google Docs via MCP.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3.5 space-y-3 scrollbar-thin [scrollbar-color:rgba(135,129,211,0.5)_transparent] overscroll-contain">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Implement Google Docs batchUpdate handler"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 rounded-md bg-background/50 border-border/80 text-sm font-normal focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description / Executive Note
            </Label>
            <Textarea
              id="desc"
              rows={2}
              placeholder="Brief summary of what changed or what needs to be implemented..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none resize-none min-h-14.5 leading-relaxed p-2.5 text-sm font-normal"
            />
          </div>

          {/* Priority Segmented Control */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Priority
            </Label>
            <div className="grid grid-cols-3 gap-1 bg-muted/40 dark:bg-muted/20 rounded-xl p-1 border border-border/60">
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
                      "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer select-none min-w-0",
                      isSelected
                        ? "bg-moody-blue-600 text-white shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-white" : item.color)} />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Status Segmented Control */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Initial Status
            </Label>
            <div className="grid grid-cols-3 gap-1 bg-muted/40 dark:bg-muted/20 rounded-xl p-1 border border-border/60">
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
                      "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer select-none min-w-0",
                      isSelected
                        ? "bg-moody-blue-600 text-white shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due Date & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Due Date */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Date
              </Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-sm h-9 rounded-md bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none",
                        !date && "text-muted-foreground"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-moody-blue-500" />
                  {date ? format(date, "PPP") : <span>Pick target date</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 glass-panel border border-border/80 shadow-xl rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label htmlFor="tags" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tags (comma separated)
              </Label>
              <div className="relative">
                <Tag className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Backend, MCP, Auth"
                  className="pl-8 h-9 rounded-md bg-background/50 border-border/80 text-sm font-normal focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sync to Docs Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-moody-blue-500/10 border border-moody-blue-500/20 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-moody-blue-600 dark:text-moody-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">Sync with Google Docs via MCP</p>
                <p className="text-xs font-normal text-muted-foreground truncate">Appends task to engineering log in linked document</p>
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
        <div className="px-5 py-3 border-t border-border/50 bg-muted/20 dark:bg-card/40 backdrop-blur-md shrink-0 flex items-center justify-end gap-2.5 rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="rounded-md text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer h-9 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-md bg-linear-to-r from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 text-white font-semibold text-sm px-4.5 h-9 shadow-md shadow-moody-blue-600/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

