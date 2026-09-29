"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  ExternalLink,
  Edit2,
  Calendar,
  CheckCircle2,
  Clock,
  User,
  FolderGit2,
  FileText,
  Tag,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBadge } from "@/components/ui/status-badge"
import { TypeBadge } from "@/components/ui/type-badge"
import { PriorityIndicator } from "@/components/ui/priority-indicator"
import { CareerStar } from "@/components/ui/career-star"
import { Task, TaskStatus, useTaskStore } from "@/store/useTaskStore"
import { useIntegrationStore } from "@/store/useIntegrationStore"
import { cn } from "@/lib/utils"

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (task: Task) => void
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onEdit,
}: TaskDetailDialogProps) {
  const { toggleCareerHighlight, updateTaskStatus } = useTaskStore()
  const { targetDocId } = useIntegrationStore()
  const [copiedEvidence, setCopiedEvidence] = React.useState(false)

  if (!task) return null

  const handleCopyEvidence = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEvidence(true)
    setTimeout(() => setCopiedEvidence(false), 2000)
  }

  const isUrl = (str: string) => {
    try {
      return str.startsWith("http://") || str.startsWith("https://")
    } catch {
      return false
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-card-foreground border border-border rounded-xl shadow-xl flex max-h-[90vh] w-[calc(100vw-2rem)] sm:max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 shrink-0 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  <FolderGit2 className="h-3 w-3" />
                  {task.project || "General"}
                </span>
                {task.area && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    /{task.area}
                  </span>
                )}
                <TypeBadge type={task.type} />
                <PriorityIndicator priority={task.priority} />
              </div>

              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug wrap-break-word">
                {task.title}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <CareerStar
                isStarred={Boolean(task.isCareerHighlight)}
                onToggle={() => toggleCareerHighlight(task.id)}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Status & Sync Status Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                <select
                  value={task.status}
                  onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                  className="bg-card border border-input rounded-md px-2.5 py-1 text-xs font-medium text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="blocked">Blocked</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {task.syncedToDocs ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Synced to Google Docs</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Pending Doc Sync</span>
                  </span>
                )}

                {task.syncedToDocs && targetDocId && (
                  <a
                    href={`https://docs.google.com/document/d/${targetDocId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>View in Doc</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Description & Architecture Notes</span>
              </h4>
              {task.description ? (
                <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No detailed description provided.</p>
              )}
            </div>

            {/* Impact & Outcome */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Impact & Business Outcome</span>
              </h4>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                {task.outcome ? (
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {task.outcome}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No outcome recorded yet. Add measurable metrics or business value for your appraisal.
                  </p>
                )}

                {task.isCareerHighlight && (
                  <div className="pt-2 border-t border-primary/15 flex items-center gap-2 text-xs font-medium text-highlight">
                    <span>★ Marked as Career Highlight for promotion / appraisal dossier</span>
                  </div>
                )}
              </div>
            </div>

            {/* Evidence & Proof Link */}
            {task.evidence && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  <span>Evidence / Proof of Work</span>
                </h4>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-xs font-mono truncate text-foreground flex-1">
                    {isUrl(task.evidence) ? (
                      <a
                        href={task.evidence}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                      >
                        <span className="truncate">{task.evidence}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span>{task.evidence}</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyEvidence(task.evidence || "")}
                    className="h-7 text-xs gap-1 shrink-0"
                  >
                    {copiedEvidence ? (
                      <>
                        <Check className="h-3 w-3 text-success" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border pt-4">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date Logged
                </span>
                <p className="text-xs font-medium text-foreground">
                  {format(new Date(task.date), "MMMM d, yyyy")}
                </p>
              </div>

              {task.dueDate && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Due Date
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {format(new Date(task.dueDate), "MMMM d, yyyy")}
                  </p>
                </div>
              )}

              {task.requestedBy && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Requested By
                  </span>
                  <p className="text-xs font-medium text-foreground">{task.requestedBy}</p>
                </div>
              )}
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contribution Notes Log */}
            {task.contributions && task.contributions.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contribution Notes History ({task.contributions.length})
                </h4>
                <div className="space-y-2">
                  {task.contributions.map((note, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border/60 bg-muted/15 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                        <span>Note entry #{idx + 1}</span>
                        <span>{format(new Date(note.loggedAt), "MMM d, yyyy · h:mm a")}</span>
                      </div>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Footer */}
        <div className="border-t border-border px-6 py-3.5 bg-muted/20 flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>

          {onEdit && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onEdit(task)
              }}
              className="gap-1.5 text-xs"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Task</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
