"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
  Check,
  Clock,
  FileText,
  Plus,
} from "lucide-react"

import { useTaskStore, Task } from "@/store/useTaskStore"
import { TaskDialog } from "@/components/task-dialog"
import { TaskDetailDialog } from "@/components/task-detail-dialog"
import { PaginationBar } from "@/components/ui/pagination-bar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { TypeBadge } from "@/components/ui/type-badge"
import { PriorityIndicator } from "@/components/ui/priority-indicator"
import { CareerStar } from "@/components/ui/career-star"
import { cn } from "@/lib/utils"

export function TaskGridView({ tasks }: { tasks: Task[] }) {
  const { toggleCareerHighlight, deleteTask } = useTaskStore()
  const [editingTask, setEditingTask] = React.useState<Task | null>(null)
  const [viewingTask, setViewingTask] = React.useState<Task | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(9)

  React.useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(tasks.length / pageSize))
    if (currentPage > maxPage) {
      setCurrentPage(1)
    }
  }, [tasks.length, pageSize, currentPage])

  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border flex min-h-72 flex-col items-center justify-center rounded-xl p-8 text-center shadow-xs">
        <FileText className="text-muted-foreground h-10 w-10 mb-3" />
        <h3 className="text-foreground text-base font-semibold">No tasks found</h3>
        <p className="text-muted-foreground max-w-sm text-sm mt-1 mb-4">
          No tasks match your current filters. Add a task to start tracking your contributions.
        </p>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span>Add task</span>
        </Button>
        <TaskDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    )
  }

  const startIndex = (currentPage - 1) * pageSize
  const paginatedTasks = tasks.slice(startIndex, startIndex + pageSize)

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {paginatedTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <Card
                  className={cn(
                    "p-4 flex flex-col justify-between h-full space-y-3 bg-card border border-border/80 rounded-xl shadow-xs hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer group",
                    task.isCareerHighlight && "border-l-4 border-l-amber-500"
                  )}
                  onClick={() => setViewingTask(task)}
                >
                  <div className="space-y-2.5">
                    {/* Header: Project / Area & Star */}
                    <div
                      className="flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
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

                    {/* Title */}
                    <h3 className="text-foreground text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {task.title}
                    </h3>

                    {/* Description */}
                    {task.description && (
                      <p className="text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Outcome */}
                    {task.outcome && (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded-lg">
                        <span className="font-semibold text-foreground">Impact: </span>
                        {task.outcome}
                      </p>
                    )}

                    {/* Type and Priority badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <TypeBadge type={task.type} />
                      <PriorityIndicator priority={task.priority} showLabel={false} />
                      {task.syncedToDocs ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full ml-auto">
                          <Check className="h-3 w-3" />
                          <span>Synced</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full ml-auto">
                          <Clock className="h-3 w-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Status & Actions */}
                  <div
                    className="border-t border-border/80 pt-3 flex items-center justify-between text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={task.status} />
                      <span className="text-muted-foreground text-[11px] tabular-nums">
                        {format(new Date(task.date), "MMM d")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {task.evidence && (
                        <a
                          href={task.evidence}
                          target="_blank"
                          rel="noreferrer"
                          title={task.evidence}
                          className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingTask(task)}
                        title="View details"
                        className="p-1 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTask(task)}
                        title="Edit task"
                        className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        title="Delete task"
                        className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Grid Pagination Bar */}
        <div className="bg-card border border-border rounded-xl">
          <PaginationBar
            currentPage={currentPage}
            totalItems={tasks.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 9, 18, 27]}
          />
        </div>
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
