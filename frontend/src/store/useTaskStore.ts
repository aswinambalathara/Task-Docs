import { create } from "zustand"

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string // ISO string
  createdAt: string
  syncedToDocs?: boolean
  tags?: string[]
  contributionsCount?: number
}

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
  fetchTasks: () => Promise<void>
  addTask: (task: Omit<Task, "id" | "createdAt">) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskDone: (id: string) => Promise<void>
  toggleSync: (id: string) => Promise<void>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

// Retrieve token from auth store or fallback to default dev mock user
function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") {
    return { Authorization: "Bearer usr_clerk_gh_89234" }
  }
  try {
    const raw = localStorage.getItem("tethr-auth-storage")
    if (raw) {
      const parsed = JSON.parse(raw)
      const userId = parsed?.state?.user?.id
      if (userId) {
        return { Authorization: `Bearer ${userId}` }
      }
    }
  } catch {
    // ignore json parsing errors
  }
  return { Authorization: "Bearer usr_clerk_gh_89234" }
}

interface BackendTask {
  id: string
  user_id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  contributions?: { note: string; logged_at: string }[]
  synced_to_docs?: boolean
  tags?: string[]
  created_at: string
  updated_at: string
}

function mapBackendToTask(t: BackendTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    status: t.status,
    priority: t.priority,
    syncedToDocs: t.synced_to_docs ?? false,
    tags: t.tags && t.tags.length > 0 ? t.tags : ["General"],
    createdAt: t.created_at,
    contributionsCount: t.contributions ? t.contributions.length : 0,
  }
}

// Initial fallback data
const initialTasks: Task[] = [
  {
    id: "1",
    title: "Implement MCP Server HTTP/SSE Transport",
    description:
      "Provide JSON-RPC 2.0 endpoints for add_task, update_task, and sync_docs tools under /api/mcp.",
    status: "done",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    syncedToDocs: true,
    tags: ["MCP", "Backend", "SSE"],
    contributionsCount: 3,
  },
  {
    id: "2",
    title: "Google Docs API batchUpdate Integration",
    description:
      "Append automated markdown formatted executive logs into linked Google Document with zero backend LLM overhead.",
    status: "in_progress",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    syncedToDocs: true,
    tags: ["Google Docs", "OAuth", "API"],
    contributionsCount: 1,
  },
  {
    id: "3",
    title: "Build Modern Developer Task Dashboard",
    description:
      "Design sleek glassmorphic UI with quick date/time picking, filters, status toggles, and live sync badges.",
    status: "in_progress",
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    syncedToDocs: false,
    tags: ["Frontend", "Tailwind", "Motion"],
    contributionsCount: 0,
  },
  {
    id: "4",
    title: "Configure Clerk JWKS Token Verification",
    description:
      "Validate RS256 Bearer JWT in incoming MCP JSON-RPC requests to extract authenticated clerk_user_id securely.",
    status: "todo",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    syncedToDocs: false,
    tags: ["Auth", "Security", "Clerk"],
    contributionsCount: 0,
  },
  {
    id: "5",
    title: "Setup MongoDB Atlas Collection Indexing",
    description:
      "Ensure compound indexes on { userId: 1, status: 1 } and { userId: 1, createdAt: -1 } for fast query response.",
    status: "todo",
    priority: "low",
    dueDate: new Date(Date.now() + 86400000 * 6).toISOString(),
    createdAt: new Date().toISOString(),
    syncedToDocs: false,
    tags: ["Database", "MongoDB"],
    contributionsCount: 0,
  },
]

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: initialTasks,
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/tasks?limit=100`, {
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
        if (data.items.length > 0) {
          set({
            tasks: data.items.map(mapBackendToTask),
            isLoading: false,
            error: null,
          })
        } else {
          // If database has 0 tasks for this user, show empty or keep fallback
          set({ tasks: [], isLoading: false, error: null })
        }
      }
    } catch {
      // Gracefully fall back to local tasks if backend is offline
      set({ isLoading: false })
    }
  },

  addTask: async (taskData) => {
    const tempId = crypto.randomUUID()
    const newTask: Task = {
      ...taskData,
      id: tempId,
      createdAt: new Date().toISOString(),
      syncedToDocs: taskData.syncedToDocs ?? false,
      tags: taskData.tags && taskData.tags.length > 0 ? taskData.tags : ["General"],
      contributionsCount: 0,
    }

    // Optimistic UI update
    set((state) => ({
      tasks: [newTask, ...state.tasks],
    }))

    // Sync with FastAPI backend
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          tags: newTask.tags,
        }),
      })

      if (res.ok) {
        const created: BackendTask = await res.json()
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === tempId ? mapBackendToTask(created) : t)),
        }))
      }
    } catch {
      // Kept in optimistic local state if backend is offline
    }
  },

  updateTask: async (id, updates) => {
    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
    }))

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: updates.title,
          description: updates.description,
          status: updates.status,
          priority: updates.priority,
          synced_to_docs: updates.syncedToDocs,
          tags: updates.tags,
        }),
      })
    } catch {
      // Offline fallback
    }
  },

  deleteTask: async (id) => {
    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }))

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
    } catch {
      // Offline fallback
    }
  },

  toggleTaskDone: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return

    const newStatus: TaskStatus = task.status === "done" ? "in_progress" : "done"
    const newSynced = newStatus === "done" ? true : task.syncedToDocs

    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: newStatus, syncedToDocs: newSynced } : t
      ),
    }))

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          synced_to_docs: newSynced,
        }),
      })
    } catch {
      // Offline fallback
    }
  },

  toggleSync: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return

    const newSync = !task.syncedToDocs

    // Optimistic UI update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, syncedToDocs: newSync } : t)),
    }))

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          synced_to_docs: newSync,
        }),
      })
    } catch {
      // Offline fallback
    }
  },
}))
