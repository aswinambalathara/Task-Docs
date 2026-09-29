"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  Edit2,
  Trash2,
  ExternalLink,
  Check,
  Eye,
  Calendar,
} from "lucide-react"

import {
  useTaskStore,
  Task,
  TaskStatus,
} from "@/store/useTaskStore"
import { TaskDialog } from "@/components/task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { Card } from "@/components/ui/card"
import { PriorityIndicator } from "@/components/ui/priority-indicator"
import { TypeBadge } from "@/components/ui/type-badge"
import { CareerStar } from "@/components/ui/career-star"
import { cn } from "@/lib/utils"

const KANBAN_COLUMNS: {
  id: TaskStatus
  label: string
  dotClass: string
  headerBg: string
  badgeBg: string
  emptyText: string
}[] = [
  {
    id: "todo",
    label: "To do",
    dotClass: "bg-slate-500 dark:bg-slate-400",
    headerBg: "text-slate-800 dark:text-slate-200",
    badgeBg: "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    emptyText: "No tasks in To do",
  },
  {
    id: "in_progress",
    label: "In progress",
    dotClass: "bg-blue-600 dark:bg-blue-400",
    headerBg: "text-blue-900 dark:text-blue-200",
    badgeBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300",
    emptyText: "No active tasks in progress",
  },
  {
    id: "done",
    label: "Done",
    dotClass: "bg-emerald-600 dark:bg-emerald-400",
    headerBg: "text-emerald-900 dark:text-emerald-200",
    badgeBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300",
    emptyText: "No completed tasks yet",
  },
  {
    id: "blocked",
    label: "Blocked",
    dotClass: "bg-rose-600 dark:bg-rose-400",
    headerBg: "text-rose-900 dark:text-rose-200",
    badgeBg: "bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300",
    emptyText: "No blocked items",
  },
]

const CARDS_PER_COLUMN_PAGE = 5

export function TaskKanbanView({ tasks }: { tasks: Task[] }) {
  const { toggleCareerHighlight, updateTaskStatus, deleteTask } = useTaskStore()
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [viewingTask, setViewingTask] = React.useState<Task | null>(null)
  const [columnPages, setColumnPages] = React.useState<Record<string, number>>({})

  const moveTask = (task: Task, direction: "next" | "prev") => {
    const sequence: TaskStatus[] = ["todo", "in_progress", "done"]
    const currentIndex = sequence.indexOf(task.status)

    if (direction === "next") {
      if (task.status === "blocked") {
        updateTaskStatus(task.id, "in_progress")
      } else if (currentIndex >= 0 && currentIndex < sequence.length - 1) {
        updateTaskStatus(task.id, sequence[currentIndex + 1])
      }
    } else {
      if (task.status === "blocked") {
        updateTaskStatus(task.id, "todo")
      } else if (currentIndex > 0) {
        updateTaskStatus(task.id, sequence[currentIndex - 1])
      }
    }
  }

  const setPage = (colId: string, page: number) => {
    setColumnPages((prev) => ({ ...prev, [colId]: page }))
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id)
          const currentPage = columnPages[col.id] || 1
          const totalPages = Math.max(1, Math.ceil(colTasks.length / CARDS_PER_COLUMN_PAGE))
          const startIndex = (currentPage - 1) * CARDS_PER_COLUMN_PAGE
          const paginatedTasks = colTasks.slice(startIndex, startIndex + CARDS_PER_COLUMN_PAGE)

          return (
            <div
              key={col.id}
              className="bg-slate-100/80 dark:bg-muted/30 border border-slate-200/90 dark:border-border/70 rounded-xl p-3 flex flex-col min-w-0 shadow-xs transition-colors"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2 px-1 border-b border-slate-200/60 dark:border-border/40">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", col.dotClass)} aria-hidden="true" />
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider truncate", col.headerBg)}>
                    {col.label}
                  </h3>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 shadow-xs", col.badgeBg)}>
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List in Column */}
              <div className="flex-1 space-y-2.5 min-h-90">
                <AnimatePresence mode="popLayout">
                  {colTasks.length === 0 ? (
                    <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-border/80 bg-white/60 dark:bg-card/40 text-center p-4">
                      <p className="text-muted-foreground text-xs font-medium">{col.emptyText}</p>
                    </div>
                  ) : (
                    paginatedTasks.map((task) => {
                      return (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Card
                            className={cn(
                              "p-3.5 bg-white dark:bg-card border border-slate-200 dark:border-border/80 rounded-xl shadow-xs hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer group",
                              task.isCareerHighlight && "border-l-4 border-l-amber-500 dark:border-l-amber-400"
                            )}
                            onClick={() => setViewingTask(task)}
                          >
                            <div className="space-y-2.5">
                              {/* Top Row: Project & Career Star */}
                              <div className="flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <span className="text-foreground font-semibold truncate">
                                    {task.project || "General"}
                                  </span>
                                  {task.area && (
                                    <span className="font-mono text-muted-foreground truncate text-[11px]">
                                      /{task.area}
                                    </span>
                                  )}
                                </div>

                                <CareerStar
                                  isStarred={Boolean(task.isCareerHighlight)}
                                  onToggle={() => toggleCareerHighlight(task.id)}
                                />
                              </div>

                              {/* Title & Description */}
                              <div>
                                <h4 className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-muted-foreground text-xs line-clamp-2 mt-1 leading-relaxed">
                                    {task.description}
                                  </p>
                                )}
                              </div>

                              {/* Outcome Preview if present */}
                              {task.outcome && (
                                <p className="text-xs text-muted-foreground line-clamp-1 bg-muted/40 p-1.5 rounded-md">
                                  <span className="font-semibold text-foreground">Impact: </span>
                                  {task.outcome}
                                </p>
                              )}

                              {/* Badges: Type, Priority, Synced */}
                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <TypeBadge type={task.type} />
                                  <PriorityIndicator priority={task.priority} showLabel={false} />
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  {task.evidence && (
                                    <span title={task.evidence} className="text-primary hover:underline">
                                      <ExternalLink className="h-3 w-3" />
                                    </span>
                                  )}
                                  {task.syncedToDocs && (
                                    <span className="text-success inline-flex items-center gap-0.5 text-[11px] font-medium" title="Synced to Google Docs">
                                      <Check className="h-3 w-3" />
                                      <span>Synced</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Quick-Advance & Actions Footer */}
                            <div
                              className="flex items-center justify-between border-t border-slate-100 dark:border-border/60 pt-2.5 mt-2.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Left & Right advance buttons */}
                              <div className="flex items-center gap-1">
                                {col.id !== "todo" && (
                                  <button
                                    type="button"
                                    onClick={() => moveTask(task, "prev")}
                                    aria-label="Move task back"
                                    title="Move backward"
                                    className="rounded-md p-1 text-muted-foreground hover:bg-slate-200/70 dark:hover:bg-muted hover:text-foreground transition-colors"
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {col.id !== "done" && (
                                  <button
                                    type="button"
                                    onClick={() => moveTask(task, "next")}
                                    aria-label="Advance task to next stage"
                                    title="Move forward"
                                    className="rounded-md p-1 text-muted-foreground hover:bg-slate-200/70 dark:hover:bg-muted hover:text-foreground transition-colors"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* View / Edit / Delete action icons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingTask(task)}
                                  aria-label={`View details of ${task.title}`}
                                  title="View full details"
                                  className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTask(task)}
                                  aria-label={`Edit task ${task.title}`}
                                  title="Edit task"
                                  className="rounded-md p-1 text-muted-foreground hover:bg-slate-200/70 dark:hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTask(task.id)}
                                  aria-label={`Delete task ${task.title}`}
                                  title="Delete task"
                                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      )
                    })
                  )}
                </AnimatePresence>
              </div>

              {/* Column Pagination Controls (if column has more than 5 cards) */}
              {colTasks.length > CARDS_PER_COLUMN_PAGE && (
                <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200/60 dark:border-border/40 text-[11px] text-muted-foreground">
                  <span>
                    {startIndex + 1}–{Math.min(startIndex + CARDS_PER_COLUMN_PAGE, colTasks.length)} of {colTasks.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(col.id, currentPage - 1)}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <span className="font-semibold text-foreground px-1">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage(col.id, currentPage + 1)}
                      className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
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
