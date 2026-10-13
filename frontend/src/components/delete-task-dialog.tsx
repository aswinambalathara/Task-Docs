"use client"

import * as React from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Task, useTaskStore } from "@/store/useTaskStore"

interface DeleteTaskDialogProps {
  // The task to confirm deleting; null keeps the dialog closed
  task: Task | null
  onOpenChange: (open: boolean) => void
}

export function DeleteTaskDialog({ task, onOpenChange }: DeleteTaskDialogProps) {
  const { deleteTask } = useTaskStore()
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Keep the last task while the close animation runs
  const [shown, setShown] = React.useState<Task | null>(task)
  if (task && task !== shown) {
    setShown(task)
    setError(null)
  }

  const handleDelete = async () => {
    if (!task) return
    setIsDeleting(true)
    setError(null)
    const res = await deleteTask(task.id)
    setIsDeleting(false)
    if (res.success) {
      onOpenChange(false)
    } else {
      setError(res.error || "Couldn't delete the task")
    }
  }

  return (
    <Dialog
      open={task !== null}
      onOpenChange={(open) => {
        // Don't close mid-request: the result must be shown in this dialog
        if (!isDeleting) onOpenChange(open)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="bg-card text-card-foreground border border-border rounded-xl shadow-xl w-[calc(100vw-2rem)] sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        <div className="flex gap-4 p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="min-w-0 space-y-2">
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete this task?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground wrap-break-word">
                &ldquo;{shown?.title}&rdquo;
              </span>{" "}
              and its contribution notes will be permanently deleted. This can&apos;t be undone.
              {shown?.syncedToDocs && " It will also be removed from your Google Doc at the next sync."}
            </DialogDescription>
            {error && (
              <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-6 py-3.5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-1.5"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{isDeleting ? "Deleting..." : "Delete task"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
