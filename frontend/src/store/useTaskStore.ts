import { create } from 'zustand'

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

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
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskDone: (id: string) => void
  toggleSync: (id: string) => void
}

// Rich initial data reflecting actual TaskDocs PRD engineering tasks
const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Implement MCP Server HTTP/SSE Transport',
    description: 'Provide JSON-RPC 2.0 endpoints for add_task, update_task, and sync_docs tools under /api/mcp.',
    status: 'done',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    syncedToDocs: true,
    tags: ['MCP', 'Backend', 'SSE'],
    contributionsCount: 3,
  },
  {
    id: '2',
    title: 'Google Docs API batchUpdate Integration',
    description: 'Append automated markdown formatted executive logs into linked Google Document with zero backend LLM overhead.',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    syncedToDocs: true,
    tags: ['Google Docs', 'OAuth', 'API'],
    contributionsCount: 1,
  },
  {
    id: '3',
    title: 'Build Modern Developer Task Dashboard',
    description: 'Design sleek glassmorphic UI with quick date/time picking, filters, status toggles, and live sync badges.',
    status: 'in_progress',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    syncedToDocs: false,
    tags: ['Frontend', 'Tailwind', 'Motion'],
    contributionsCount: 0,
  },
  {
    id: '4',
    title: 'Configure Clerk JWKS Token Verification',
    description: 'Validate RS256 Bearer JWT in incoming MCP JSON-RPC requests to extract authenticated clerk_user_id securely.',
    status: 'todo',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    syncedToDocs: false,
    tags: ['Auth', 'Security', 'Clerk'],
    contributionsCount: 0,
  },
  {
    id: '5',
    title: 'Setup MongoDB Atlas Collection Indexing',
    description: 'Ensure compound indexes on { userId: 1, status: 1 } and { userId: 1, createdAt: -1 } for fast query response.',
    status: 'todo',
    priority: 'low',
    dueDate: new Date(Date.now() + 86400000 * 6).toISOString(),
    createdAt: new Date().toISOString(),
    syncedToDocs: false,
    tags: ['Database', 'MongoDB'],
    contributionsCount: 0,
  }
]

export const useTaskStore = create<TaskState>((set) => ({
  tasks: initialTasks,
  addTask: (taskData) => set((state) => ({
    tasks: [
      {
        ...taskData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        syncedToDocs: taskData.syncedToDocs ?? false,
        tags: taskData.tags && taskData.tags.length > 0 ? taskData.tags : ['General'],
        contributionsCount: 0,
      },
      ...state.tasks,
    ]
  })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((task) => 
      task.id === id ? { ...task, ...updates } : task
    )
  })),
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((task) => task.id !== id)
  })),
  toggleTaskDone: (id) => set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== id) return task
      const newStatus: TaskStatus = task.status === 'done' ? 'in_progress' : 'done'
      return {
        ...task,
        status: newStatus,
        syncedToDocs: newStatus === 'done' ? true : task.syncedToDocs,
      }
    })
  })),
  toggleSync: (id) => set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, syncedToDocs: !task.syncedToDocs } : task
    )
  })),
}))
