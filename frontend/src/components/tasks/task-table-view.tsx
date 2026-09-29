"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  FileText,
  Edit2,
  Trash2,
  Plus,
  PlusCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  ExternalLink,
  Eye,
} from "lucide-react"

import { useTaskStore, Task, TaskStatus } from "@/store/useTaskStore"
import { motion, AnimatePresence } from "framer-motion"
import { TaskDialog } from "@/components/task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { Button } from "@/components/ui/button"
import { PriorityIndicator } from "@/components/ui/priority-indicator"
import { TypeBadge } from "@/components/ui/type-badge"
import { CareerStar } from "@/components/ui/career-star"
import { cn } from "@/lib/utils"

export function TaskTableView({ tasks }: { tasks: Task[] }) {
  const { toggleCareerHighlight, updateTaskStatus, deleteTask, addContribution } = useTaskStore()
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({})
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [viewingTask, setViewingTask] = React.useState<Task | null>(null)
  const [newNoteTaskId, setNewNoteTaskId] = React.useState<string | null>(null)
  const [newNoteText, setNewNoteText] = React.useState("")
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // Reset to page 1 if total tasks change drastically
  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(tasks.length / pageSize))
    if (currentPage > maxPage) {
      setCurrentPage(1)
    }
  }, [tasks.length, pageSize, currentPage])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddNote = async (taskId: string) => {
    if (!newNoteText.trim()) return
    await addContribution(taskId, newNoteText.trim())
    setNewNoteText("")
    setNewNoteTaskId(null)
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border flex min-h-72 flex-col items-center justify-center rounded-xl p-8 text-center shadow-xs">
        <FileText className="text-muted-foreground h-10 w-10 mb-3" />
        <h3 className="text-foreground text-base font-semibold">Log your first contribution</h3>
        <p className="text-muted-foreground max-w-sm text-sm mt-1 mb-4">
          No tasks match your current filters. Add a task to start tracking your impact and Google Docs sync.
        </p>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span>Add task</span>
        </Button>
        <TaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    )
  }

  // Calculate paginated slice
  const startIndex = (currentPage - 1) * pageSize
  const paginatedTasks = tasks.slice(startIndex, startIndex + pageSize)

  return (
    <>
      <div className="bg-card border border-border w-full overflow-hidden rounded-xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/70 text-muted-foreground sticky top-0 z-10 border-b border-border text-xs font-semibold uppercase tracking-wider select-none">
                <th className="py-3 px-3 w-10 text-center">⭐</th>
                <th className="py-3 px-3 min-w-52">Contribution</th>
                <th className="py-3 px-3 min-w-28">Project</th>
                <th className="py-3 px-3 min-w-24">Area</th>
                <th className="py-3 px-3 min-w-24">Type</th>
                <th className="py-3 px-3 min-w-24">Priority</th>
                <th className="py-3 px-3 min-w-32">Status</th>
                <th className="py-3 px-3 min-w-44">Outcome & Evidence</th>
                <th className="py-3 px-3 min-w-24 text-center">Docs Sync</th>
                <th className="py-3 px-3 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {paginatedTasks.map((task) => {
                  const isExpanded = Boolean(expandedRows[task.id])

                  return (
                    <React.Fragment key={task.id}>
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "group transition-all hover:bg-muted/40 border-b border-border/80",
                          task.isCareerHighlight && "border-l-4 border-l-amber-500"
                        )}
                      >
                      {/* Career Highlight Star Toggle */}
                      <td className="py-3 px-2 text-center align-top">
                        <CareerStar
                          isStarred={Boolean(task.isCareerHighlight)}
                          onToggle={() => toggleCareerHighlight(task.id)}
                        />
                      </td>

                      {/* Contribution / Title */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setViewingTask(task)}
                            className="text-foreground font-semibold leading-snug text-left hover:text-primary transition-colors cursor-pointer"
                          >
                            {task.title}
                          </button>
                          {task.description && (
                            <p className="text-muted-foreground line-clamp-1 text-xs">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                            <span className="text-muted-foreground tabular-nums text-xs">
                              {format(new Date(task.date), "MMM d, yyyy")}
                            </span>
                            {task.contributions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleRow(task.id)}
                                className="text-primary hover:underline inline-flex items-center gap-0.5 text-xs font-medium cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                <span>{task.contributions.length} note(s)</span>
                              </button>
                            )}
                            {task.requestedBy && (
                              <span className="text-muted-foreground text-xs italic">
                                by {task.requestedBy}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="py-3 px-3 align-top">
                        <span className="text-foreground font-medium text-xs sm:text-sm">
                          {task.project || "—"}
                        </span>
                      </td>

                      {/* Technical Area */}
                      <td className="py-3 px-3 align-top">
                        <span className="text-muted-foreground text-xs font-mono">
                          {task.area ? `/${task.area}` : "—"}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3 align-top">
                        <TypeBadge type={task.type} />
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3 align-top">
                        <PriorityIndicator priority={task.priority} />
                      </td>

                      {/* Inline Status Dropdown */}
                      <td className="py-3 px-3 align-top">
                        <select
                          value={task.status}
                          onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                          aria-label="Update task status"
                          className="bg-card border border-input rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
                        >
                          <option value="todo">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                          <option value="blocked">Blocked</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* Outcome & Evidence */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1 max-w-56">
                          {task.outcome ? (
                            <p className="text-foreground text-xs leading-snug line-clamp-2" title={task.outcome}>
                              {task.outcome}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No outcome logged</span>
                          )}
                          {task.evidence && (
                            <div className="flex items-center gap-1">
                              <span className="text-primary hover:underline underline-offset-4 text-xs font-mono inline-flex items-center gap-1 cursor-pointer truncate">
                                <span className="truncate">{task.evidence}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Google Docs Sync Status */}
                      <td className="py-3 px-3 align-top text-center">
                        {task.syncedToDocs ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                            title="Synchronized to Google Docs"
                          >
                            <Check className="h-3 w-3" />
                            <span>Synced</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                            title="Pending next scheduled/manual sync"
                          >
                            <Clock className="h-3 w-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-2 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingTask(task)}
                            aria-label={`View full details of ${task.title}`}
                            title="View full details"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTask(task)}
                            aria-label={`Edit task ${task.title}`}
                            title="Edit task"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTask(task.id)}
                            aria-label={`Delete task ${task.title}`}
                            title="Delete task"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expandable Engineering Contribution Log History */}
                    {isExpanded && (
                      <tr className="bg-muted/40 border-b border-border">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="space-y-3 pl-4 border-l-2 border-primary/40">
                            <div className="flex items-center justify-between">
                              <h4 className="text-foreground text-xs font-semibold uppercase tracking-wider">
                                Engineering Contribution Log ({task.contributions.length})
                              </h4>
                              {newNoteTaskId !== task.id && (
                                <button
                                  type="button"
                                  onClick={() => setNewNoteTaskId(task.id)}
                                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                                >
                                  <PlusCircle className="h-3 w-3" />
                                  <span>Add note</span>
                                </button>
                              )}
                            </div>

                            {/* Add Note Input Box */}
                            {newNoteTaskId === task.id && (
                              <div className="flex gap-2 items-center bg-card p-2 rounded-md border border-border">
                                <input
                                  type="text"
                                  placeholder="e.g. Completed refactor of FastMCP dispatcher"
                                  value={newNoteText}
                                  onChange={(e) => setNewNoteText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddNote(task.id)
                                  }}
                                  className="flex-1 bg-transparent text-xs text-foreground outline-none px-1"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleAddNote(task.id)}
                                  disabled={!newNoteText.trim()}
                                  className="h-7 text-xs px-2.5"
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewNoteTaskId(null)
                                    setNewNoteText("")
                                  }}
                                  className="h-7 text-xs px-2"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}

                            {/* List of Previous Contribution Notes */}
                            <div className="space-y-1.5">
                              {task.contributions.map((c, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between text-xs text-muted-foreground gap-4 bg-card/60 p-2 rounded border border-border/50"
                                >
                                  <span className="text-foreground">{c.note}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                    {format(new Date(c.loggedAt), "MMM d, h:mm a")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <PaginationBar
          currentPage={currentPage}
          totalItems={tasks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
        />
      </div>

      {/* Task Detail Review Modal */}
      {viewingTask && (
        <TaskDetailDialog
          task={viewingTask}
          open={Boolean(viewingTask)}
          onOpenChange={(isOpen) => !isOpen && setViewingTask(null)}
          onEdit={(task) => {
            setViewingTask(null)
            setEditingTask(task)
          }}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskDialog
          initialTask={editingTask}
          open={Boolean(editingTask)}
          onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
        />
      )}
    </>
  )
}
