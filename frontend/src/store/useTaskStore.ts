import { create } from "zustand"
import { useIntegrationStore } from "./useIntegrationStore"

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export const DEVELOPER_TASK_TYPES = [
  "Feature",
  "Bug Fix",
  "Improvement",
  "Investigation",
  "Research / POC",
  "Performance",
  "Infrastructure",
  "AI / LLM",
  "UI / UX",
  "Data",
] as const

export type DeveloperTaskType = (typeof DEVELOPER_TASK_TYPES)[number]

export interface Contribution {
  note: string
  loggedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  type: DeveloperTaskType
  project: string
  area?: string
  outcome?: string
  evidence?: string
  requestedBy?: string
  isCareerHighlight: boolean
  dueDate?: string
  date: string
  createdAt: string
  updatedAt?: string
  syncedToDocs: boolean
  tags: string[]
  contributions: Contribution[]
  contributionsCount: number
}

export type CreateTaskInput = {
  title: string
  description?: string
  project?: string
  area?: string
  type?: DeveloperTaskType
  status?: TaskStatus
  priority?: TaskPriority
  outcome?: string
  evidence?: string
  requestedBy?: string
  isCareerHighlight?: boolean
  dueDate?: string
  tags?: string[]
}

export interface TaskFilters {
  status?: TaskStatus | "all"
  priority?: TaskPriority | "all"
  type?: DeveloperTaskType | "all"
  project?: string
  highlight?: boolean
  search?: string
}

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  activeFilters: TaskFilters
  fetchTasks: (filters?: TaskFilters) => Promise<void>
  addTask: (task: CreateTaskInput) => Promise<Task | null>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  toggleCareerHighlight: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addContribution: (id: string, note: string) => Promise<void>
  setFilters: (filters: Partial<TaskFilters>) => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

// Request headers for API proxy calls (Next.js server proxy automatically injects live Clerk session token)
export function getAuthHeader(): Record<string, string> {
  return {}
}

interface BackendTask {
  id: string
  user_id: string
  date?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  type?: DeveloperTaskType
  project?: string
  area?: string
  outcome?: string
  evidence?: string
  requested_by?: string
  is_career_highlight?: boolean
  contributions?: { note: string; logged_at: string }[]
  synced_to_docs?: boolean
  tags?: string[]
  created_at: string
  updated_at?: string
}

function mapBackendToTask(t: BackendTask): Task {
  const contributions: Contribution[] = (t.contributions || []).map((c) => ({
    note: c.note,
    loggedAt: c.logged_at,
  }))

  const rawType = t.type || "Feature"
  const validType: DeveloperTaskType = DEVELOPER_TASK_TYPES.includes(rawType as DeveloperTaskType)
    ? (rawType as DeveloperTaskType)
    : "Feature"

  return {
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    status: t.status || "todo",
    priority: t.priority || "medium",
    type: validType,
    project: t.project || "General",
    area: t.area || undefined,
    outcome: t.outcome || undefined,
    evidence: t.evidence || undefined,
    requestedBy: t.requested_by || undefined,
    isCareerHighlight: Boolean(t.is_career_highlight),
    dueDate: t.date || undefined,
    date: t.date || t.created_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    syncedToDocs: Boolean(t.synced_to_docs),
    tags: t.tags && t.tags.length > 0 ? t.tags : [validType],
    contributions,
    contributionsCount: contributions.length,
  }
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  activeFilters: {},

  setFilters: (filters) => {
    const updated = { ...get().activeFilters, ...filters }
    set({ activeFilters: updated })
    get().fetchTasks(updated)
  },

  fetchTasks: async (filters) => {
    set({ isLoading: true, error: null })
    const active = filters ?? get().activeFilters

    try {
      const params = new URLSearchParams({ limit: "100" })
      if (active.status && active.status !== "all") params.append("status", active.status)
      if (active.priority && active.priority !== "all") params.append("priority", active.priority)
      if (active.type && active.type !== "all") params.append("type", active.type)
      if (active.project && active.project.trim()) params.append("project", active.project.trim())
      if (active.highlight !== undefined) params.append("highlight", String(active.highlight))
      if (active.search && active.search.trim()) params.append("search", active.search.trim())

      const res = await fetch(`${API_BASE}/tasks?${params.toString()}`, {
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`)
      }

      const data = await res.json()
      if (Array.isArray(data.items)) {
        set({
          tasks: data.items.map(mapBackendToTask),
          isLoading: false,
          error: null,
        })
      } else {
        set({ tasks: [], isLoading: false, error: null })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load tasks"
      set({ isLoading: false, error: msg })
    }
  },

  addTask: async (taskInput) => {
    const tempId = crypto.randomUUID()
    const optimisticTask: Task = {
      id: tempId,
      title: taskInput.title,
      description: taskInput.description,
      project: taskInput.project || "General",
      area: taskInput.area,
      type: taskInput.type || "Feature",
      status: taskInput.status || "todo",
      priority: taskInput.priority || "medium",
      outcome: taskInput.outcome,
      evidence: taskInput.evidence,
      requestedBy: taskInput.requestedBy,
      isCareerHighlight: Boolean(taskInput.isCareerHighlight),
      dueDate: taskInput.dueDate,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      syncedToDocs: false,
      tags: taskInput.tags && taskInput.tags.length > 0 ? taskInput.tags : [taskInput.type || "Feature"],
      contributions: [],
      contributionsCount: 0,
    }

    // Optimistic UI update
    set((state) => ({
      tasks: [optimisticTask, ...state.tasks],
    }))

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskInput.title,
          description: taskInput.description,
          project: taskInput.project || "General",
          area: taskInput.area,
          type: taskInput.type || "Feature",
          status: taskInput.status || "todo",
          priority: taskInput.priority || "medium",
          outcome: taskInput.outcome,
          evidence: taskInput.evidence,
          requested_by: taskInput.requestedBy,
          is_career_highlight: Boolean(taskInput.isCareerHighlight),
          tags: optimisticTask.tags,
        }),
      })

      if (res.ok) {
        const created: BackendTask = await res.json()
        const mapped = mapBackendToTask(created)
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === tempId ? mapped : t)),
        }))
        useIntegrationStore.getState().notifyChange()
        return mapped
      }
    } catch {
      // Kept in optimistic local state
    }
    useIntegrationStore.getState().notifyChange()
    return optimisticTask
  },

  updateTask: async (id, updates) => {
    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    }))

    try {
      const payload: Record<string, unknown> = {}
      if (updates.title !== undefined) payload.title = updates.title
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.project !== undefined) payload.project = updates.project
      if (updates.area !== undefined) payload.area = updates.area
      if (updates.type !== undefined) payload.type = updates.type
      if (updates.status !== undefined) payload.status = updates.status
      if (updates.priority !== undefined) payload.priority = updates.priority
      if (updates.outcome !== undefined) payload.outcome = updates.outcome
      if (updates.evidence !== undefined) payload.evidence = updates.evidence
      if (updates.requestedBy !== undefined) payload.requested_by = updates.requestedBy
      if (updates.isCareerHighlight !== undefined) payload.is_career_highlight = updates.isCareerHighlight
      if (updates.tags !== undefined) payload.tags = updates.tags

      const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const updated = await res.json()
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  syncedToDocs: updated.synced_to_docs ?? task.syncedToDocs,
                }
              : task
          ),
        }))
      }
    } catch {
      // Offline fallback
    }
    useIntegrationStore.getState().notifyChange()
  },

  updateTaskStatus: async (id, status) => {
    await get().updateTask(id, { status })
  },

  toggleCareerHighlight: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    const toggled = !task.isCareerHighlight
    get().updateTask(id, { isCareerHighlight: toggled })
  },

  deleteTask: async (id) => {
    const target = get().tasks.find((t) => t.id === id)
    const wasSynced = target?.syncedToDocs === true

    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }))

    if (wasSynced) {
      useIntegrationStore.getState().notifyChange({ isDeletion: true })
    } else {
      useIntegrationStore.getState().cancelAutoSyncIfClean()
    }

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
    } catch {
      // Offline fallback
    }
  },

  addContribution: async (id, note) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}/contributions`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      })

      if (res.ok) {
        const updated: BackendTask = await res.json()
        const mapped = mapBackendToTask(updated)
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? mapped : t)),
        }))
      }
    } catch {
      // Offline fallback
    }
    useIntegrationStore.getState().notifyChange()
  },
}))
