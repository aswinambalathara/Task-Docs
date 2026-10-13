import type { SimpleSelectOption } from "@/components/ui/simple-select"
import {
  DEVELOPER_TASK_TYPES,
  type DeveloperTaskType,
  type TaskPriority,
  type TaskStatus,
} from "@/store/useTaskStore"

export const STATUS_OPTIONS: SimpleSelectOption<TaskStatus>[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
  { value: "cancelled", label: "Cancelled" },
]

export const PRIORITY_OPTIONS: SimpleSelectOption<TaskPriority>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

export const TYPE_OPTIONS: SimpleSelectOption<DeveloperTaskType>[] = DEVELOPER_TASK_TYPES.map(
  (type) => ({ value: type, label: type })
)
