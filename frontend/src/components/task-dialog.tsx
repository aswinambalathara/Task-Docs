"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  FileText,
  Layers,
  Link as LinkIcon,
  Tag,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { CareerStar } from "@/components/ui/career-star"
import { cn } from "@/lib/utils"
import {
  useTaskStore,
  Task,
  TaskStatus,
  TaskPriority,
  DeveloperTaskType,
  DEVELOPER_TASK_TYPES,
} from "@/store/useTaskStore"

interface TaskDialogProps {
  initialTask?: Task | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

function TaskFormContent({
  initialTask,
  onClose,
}: {
  initialTask?: Task | null
  onClose: () => void
}) {
  const addTask = useTaskStore((state) => state.addTask)
  const updateTask = useTaskStore((state) => state.updateTask)

  const [title, setTitle] = React.useState(initialTask?.title || "")
  const [description, setDescription] = React.useState(initialTask?.description || "")
  const [project, setProject] = React.useState(initialTask?.project || "General")
  const [area, setArea] = React.useState(initialTask?.area || "")
  const [type, setType] = React.useState<DeveloperTaskType>(initialTask?.type || "Feature")
  const [status, setStatus] = React.useState<TaskStatus>(initialTask?.status || "todo")
  const [priority, setPriority] = React.useState<TaskPriority>(initialTask?.priority || "medium")
  const [outcome, setOutcome] = React.useState(initialTask?.outcome || "")
  const [evidence, setEvidence] = React.useState(initialTask?.evidence || "")
  const [requestedBy, setRequestedBy] = React.useState(initialTask?.requestedBy || "")
  const [isCareerHighlight, setIsCareerHighlight] = React.useState(Boolean(initialTask?.isCareerHighlight))
  const [date, setDate] = React.useState<Date | undefined>(() =>
    initialTask?.dueDate ? new Date(initialTask.dueDate) : initialTask?.date ? new Date(initialTask.date) : new Date()
  )
  const [tagInput, setTagInput] = React.useState((initialTask?.tags || [initialTask?.type || "Feature"]).join(", "))

  const handleSave = async () => {
    if (!title.trim()) return

    const parsedTags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)

    if (initialTask) {
      await updateTask(initialTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        project: project.trim() || "General",
        area: area.trim() || undefined,
        type,
        status,
        priority,
        outcome: outcome.trim() || undefined,
        evidence: evidence.trim() || undefined,
        requestedBy: requestedBy.trim() || undefined,
        isCareerHighlight,
        dueDate: date ? date.toISOString() : undefined,
        tags: parsedTags.length > 0 ? parsedTags : [type],
      })
    } else {
      await addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        project: project.trim() || "General",
        area: area.trim() || undefined,
        type,
        status,
        priority,
        outcome: outcome.trim() || undefined,
        evidence: evidence.trim() || undefined,
        requestedBy: requestedBy.trim() || undefined,
        isCareerHighlight,
        dueDate: date ? date.toISOString() : undefined,
        tags: parsedTags.length > 0 ? parsedTags : [type],
      })
    }

    onClose()
  }

  return (
    <DialogContent className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl flex max-h-[90vh] w-[calc(100vw-2rem)] sm:max-w-2xl flex-col gap-0 overflow-hidden p-0">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 shrink-0 bg-muted/20">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            {initialTask ? "Edit Engineering Task" : "Log New Engineering Task"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Document deliverables, technical decisions, and appraisal-worthy impact evidence.
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Form Body inside ScrollArea for clean shadcn scrollbars */}
      <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
        <div className="p-6 space-y-6">
          {/* Section: Title & Description */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Task Title <span className="text-destructive">*</span></span>
                <span className="text-[10px] text-muted-foreground font-normal">Clear & action-oriented</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g. Implement FastMCP streaming SSE transport & tools"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-medium text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Description & Architecture Notes</span>
              </Label>
              <Textarea
                id="desc"
                rows={3}
                placeholder="Architectural notes, components modified, or implementation steps..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Section: Impact & Proof of Work */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Impact & Evidence
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="outcome" className="text-xs font-medium text-foreground">
                  Outcome / Measurable Value
                </Label>
                <Input
                  id="outcome"
                  placeholder="e.g. Reduced token sync latency by 40%"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="bg-card text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evidence" className="text-xs font-medium text-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3 text-muted-foreground" />
                  <span>Evidence / Proof Link</span>
                </Label>
                <Input
                  id="evidence"
                  placeholder="e.g. PR #104, commit sha, Jira #82"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className="bg-card text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section: Technical Context & Classifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Context & Classification
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="project" className="text-xs font-medium text-foreground">
                  Project
                </Label>
                <Input
                  id="project"
                  placeholder="e.g. Tethr, Core Engine"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area" className="text-xs font-medium text-foreground">
                  Area / Domain
                </Label>
                <Input
                  id="area"
                  placeholder="e.g. Auth, DB, MCP, UI"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-type" className="text-xs font-medium text-foreground">
                  Type
                </Label>
                <select
                  id="task-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as DeveloperTaskType)}
                  className="bg-card border border-input rounded-md h-9 w-full px-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
                >
                  {DEVELOPER_TASK_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-popover text-popover-foreground">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority" className="text-xs font-medium text-foreground">
                  Priority
                </Label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="bg-card border border-input rounded-md h-9 w-full px-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
                >
                  <option value="low" className="bg-popover text-popover-foreground">Low</option>
                  <option value="medium" className="bg-popover text-popover-foreground">Medium</option>
                  <option value="high" className="bg-popover text-popover-foreground">High</option>
                  <option value="urgent" className="bg-popover text-popover-foreground">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-status" className="text-xs font-medium text-foreground">
                  Status
                </Label>
                <select
                  id="task-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="bg-card border border-input rounded-md h-9 w-full px-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
                >
                  <option value="todo" className="bg-popover text-popover-foreground">To do</option>
                  <option value="in_progress" className="bg-popover text-popover-foreground">In progress</option>
                  <option value="done" className="bg-popover text-popover-foreground">Done</option>
                  <option value="blocked" className="bg-popover text-popover-foreground">Blocked</option>
                  <option value="cancelled" className="bg-popover text-popover-foreground">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="requested-by" className="text-xs font-medium text-foreground">
                  Requested By
                </Label>
                <Input
                  id="requested-by"
                  placeholder="e.g. Staff Architect, Self"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Date</Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          "h-9 w-full justify-start text-left font-normal text-xs",
                          !date && "text-muted-foreground"
                        )}
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick date</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Section: Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <span>Tags (comma-separated)</span>
            </Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Backend, MCP, Auth, Performance"
              className="text-xs"
            />
          </div>

          {/* Career highlight card */}
          <div
            onClick={() => setIsCareerHighlight(!isCareerHighlight)}
            className={cn(
              "flex items-center gap-3.5 rounded-xl border p-3.5 cursor-pointer transition-all select-none",
              isCareerHighlight
                ? "border-amber-500/50 bg-amber-500/10 dark:bg-amber-950/20"
                : "border-border bg-muted/20 hover:bg-muted/40"
            )}
          >
            <CareerStar
              isStarred={isCareerHighlight}
              onToggle={() => setIsCareerHighlight(!isCareerHighlight)}
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-foreground">
                Mark as Career Highlight ⭐
              </span>
              <span className="text-[11px] text-muted-foreground">
                Flags this achievement for your periodic performance reviews and appraisal dossier.
              </span>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border px-6 py-3.5 flex items-center justify-end gap-2 bg-muted/20 shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={!title.trim()}
          className="text-xs gap-1.5 font-semibold"
        >
          <Check className="h-3.5 w-3.5" />
          <span>{initialTask ? "Update Task" : "Save Task"}</span>
        </Button>
      </div>
    </DialogContent>
  )
}

export function TaskDialog({
  initialTask,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: TaskDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (setControlledOpen || (() => {})) : setInternalOpen

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : isControlled || trigger === null ? null : (
        <DialogTrigger
          render={
            <Button className="gap-1.5" size="sm">
              <Plus className="h-4 w-4" />
              <span>Add task</span>
            </Button>
          }
        />
      )}
      {open && (
        <TaskFormContent
          key={initialTask?.id || "new-task"}
          initialTask={initialTask}
          onClose={handleClose}
        />
      )}
    </Dialog>
  )
}
