"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, isPast } from "date-fns"
import {
  Calendar,
  Clock,
  CheckCircle2,
  CircleDashed,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  FileText,
  Trash2,
  RefreshCw,
  Flame,
  ShieldCheck,
  Check,
  Lock,
  ArrowRight,
} from "lucide-react"

import { useTaskStore, Task, TaskStatus, TaskPriority } from "@/store/useTaskStore"
import { useAuthStore } from "@/store/useAuthStore"
import { TaskDialog } from "@/components/task-dialog"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const statusDetails: Record<
  TaskStatus,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  todo: {
    label: "To Do",
    icon: CircleDashed,
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    color: "text-moody-blue-600 dark:text-moody-blue-400",
    bg: "bg-moody-blue-500/10 border-moody-blue-500/25",
  },
  done: {
    label: "Done",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/25",
  },
}

const priorityDetails: Record<
  TaskPriority,
  { label: string; icon: React.ElementType; badgeClass: string }
> = {
  low: {
    label: "Low",
    icon: ShieldCheck,
    badgeClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
  medium: {
    label: "Medium",
    icon: Clock,
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  high: {
    label: "High",
    icon: Flame,
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
}

export default function DashboardPage() {
  const { tasks, fetchTasks, updateTask, deleteTask, toggleTaskDone, toggleSync } = useTaskStore()
  const { isAuthenticated, user, login } = useAuthStore()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  React.useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatus | "all">("all")
  const [selectedPriority, setSelectedPriority] = React.useState<TaskPriority | "all">("all")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [isSyncing, setIsSyncing] = React.useState(false)

  // Metrics computation
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "done").length
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length
  const syncedDocsCount = tasks.filter((t) => t.syncedToDocs).length
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Filter & Search Logic
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.tags && task.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus
    const matchesPriority = selectedPriority === "all" || task.priority === selectedPriority

    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleManualSync = () => {
    setIsSyncing(true)
    setTimeout(() => {
      setIsSyncing(false)
    }, 900)
  }

  const cycleStatus = (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      todo: "in_progress",
      in_progress: "done",
      done: "todo",
    }
    const updated = nextStatus[task.status]
    updateTask(task.id, {
      status: updated,
      syncedToDocs: updated === "done" ? true : task.syncedToDocs,
    })
  }

  // Initial SSR mount guard
  if (!mounted) {
    return (
      <div className="container mx-auto flex max-w-7xl items-center justify-center px-3 py-12 sm:px-6 lg:px-8">
        <div className="border-moody-blue-600 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  // Unauthenticated Protected State
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-8">
        {/* Ambient background glow */}
        <div className="bg-moody-blue-500/15 dark:bg-moody-blue-500/20 pointer-events-none absolute top-1/3 left-1/2 -z-10 h-128 w-lg -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-lg space-y-6"
        >
          <Card className="glass-panel border-border/80 shadow-moody-blue-900/10 space-y-6 rounded-3xl border p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8 dark:shadow-black/50">
            {/* Lock Badge & Header */}
            <div className="flex flex-col items-center space-y-3">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="from-moody-blue-600 to-moody-blue-800 shadow-moody-blue-600/30 border-moody-blue-400/30 inline-flex h-14 w-14 items-center justify-center rounded-2xl border bg-linear-to-br text-white shadow-xl"
              >
                <Lock className="h-7 w-7" />
              </motion.div>
              <div className="space-y-1.5">
                <div className="bg-moody-blue-500/15 text-moody-blue-600 dark:text-moody-blue-400 border-moody-blue-500/20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Developer Workspace Protected</span>
                </div>
                <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  Sign in to access your{" "}
                  <span className="from-moody-blue-600 to-moody-blue-400 bg-linear-to-r bg-clip-text text-transparent">
                    Dashboard
                  </span>
                </h1>
                <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
                  Only authenticated developers can manage sprint backlogs, review AI summaries, and
                  stream MCP updates to Google Docs.
                </p>
              </div>
            </div>

            {/* Quick 1-Click OAuth Buttons */}
            <div className="space-y-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => login("github")}
                className="border-border/80 bg-foreground/5 hover:bg-foreground/10 dark:bg-card dark:hover:bg-muted/60 text-foreground group flex h-13 w-full cursor-pointer items-center justify-between rounded-xl px-4 font-medium shadow-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-foreground text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-foreground flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                      <span>Continue with GitHub</span>
                      <span className="bg-moody-blue-500/15 text-moody-blue-600 dark:text-moody-blue-400 border-moody-blue-500/20 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Recommended
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">Instant sign-in as Alex Rivera</p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-all group-hover:translate-x-0.5" />
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => login("google")}
                className="border-border/80 bg-background hover:bg-muted/50 text-foreground group flex h-13 w-full cursor-pointer items-center justify-between rounded-xl px-4 font-medium shadow-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-card border-border/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-foreground text-sm font-semibold tracking-tight">
                      Continue with Google
                    </div>
                    <p className="text-muted-foreground text-xs">Work or personal Google account</p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-all group-hover:translate-x-0.5" />
              </Button>
            </div>

            <div className="border-border/50 text-muted-foreground border-t pt-2 text-xs">
              Stateless RS256 JWT authenticated via Clerk • Strict Multi-Tenancy
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-3 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      {/* 1. Header Banner & Actions */}
      <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-2 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-3xl leading-[1.15] font-bold tracking-tight sm:text-4xl">
              Developer{" "}
              <span className="from-moody-blue-600 via-moody-blue-500 to-moody-blue-400 bg-linear-to-r bg-clip-text text-transparent">
                Workspace
              </span>
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 sm:inline-flex dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
              Docs Synced
            </span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed font-normal sm:text-base">
            Welcome back, <span className="text-foreground font-semibold">{user?.name}</span> (
            {user?.workspaceName}). Track sprint progress and stream contributions directly into
            Google Docs via MCP.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="glass-panel border-border/80 hover:bg-muted/60 h-9 shrink-0 cursor-pointer rounded-xl px-3 text-sm font-semibold transition-all"
          >
            <RefreshCw
              className={`text-moody-blue-600 dark:text-moody-blue-400 mr-1.5 h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            <span>{isSyncing ? "Syncing..." : "Sync Docs"}</span>
          </Button>

          <TaskDialog />
        </div>
      </div>

      {/* 2. Glassmorphic Metrics HUD (Grid-safe on 320px screens) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
        {/* Total Tasks & Completion Progress */}
        <div className="glass-panel border-border/60 group hover:border-moody-blue-500/40 relative min-w-0 overflow-hidden rounded-2xl border p-3 shadow-xs transition-colors sm:p-4 lg:p-5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
              Completion Rate
            </span>
            <div className="bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0 rounded-xl p-1.5">
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1 sm:gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {progressPercentage}%
            </span>
            <span className="text-muted-foreground truncate text-xs font-normal sm:text-sm">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          {/* Progress bar */}
          <div className="bg-muted mt-2.5 h-1.5 w-full overflow-hidden rounded-full sm:mt-3">
            <div
              className="from-moody-blue-600 to-moody-blue-400 h-full rounded-full bg-linear-to-r transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* In Progress */}
        <div className="glass-panel border-border/60 group hover:border-moody-blue-500/40 min-w-0 rounded-2xl border p-3 shadow-xs transition-colors sm:p-4 lg:p-5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
              In Progress
            </span>
            <div className="bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0 rounded-xl p-1.5">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1 sm:gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {inProgressTasks}
            </span>
            <span className="text-muted-foreground truncate text-xs font-normal sm:text-sm">
              active sprints
            </span>
          </div>
          <p className="text-muted-foreground mt-2.5 flex min-w-0 items-center gap-1.5 text-xs font-medium sm:mt-3">
            <span className="bg-moody-blue-500 h-1.5 w-1.5 shrink-0 rounded-full" />
            <span className="truncate">Currently coding</span>
          </p>
        </div>

        {/* Shipped / Done */}
        <div className="glass-panel border-border/60 group min-w-0 rounded-2xl border p-3 shadow-xs transition-colors hover:border-emerald-500/40 sm:p-4 lg:p-5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
              Shipped / Done
            </span>
            <div className="shrink-0 rounded-xl bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1 sm:gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {completedTasks}
            </span>
            <span className="truncate text-xs font-medium text-emerald-600 sm:text-sm dark:text-emerald-400">
              verified
            </span>
          </div>
          <p className="text-muted-foreground mt-2.5 flex min-w-0 items-center gap-1.5 text-xs font-medium sm:mt-3">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">In changelog</span>
          </p>
        </div>

        {/* Docs Sync Health */}
        <div className="glass-panel border-border/60 group hover:border-moody-blue-500/40 min-w-0 rounded-2xl border p-3 shadow-xs transition-colors sm:p-4 lg:p-5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-muted-foreground truncate text-xs font-semibold tracking-wider uppercase">
              Docs Sync
            </span>
            <div className="bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0 rounded-xl p-1.5">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1 sm:gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {syncedDocsCount}
            </span>
            <span className="text-muted-foreground truncate text-xs font-normal sm:text-sm">
              synced items
            </span>
          </div>
          <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-emerald-600 sm:mt-3 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
            <span className="truncate">Live sync active</span>
          </p>
        </div>
      </div>

      {/* 3. Filter, Search & View Controls Bar (Adaptive layout that never overflows at 320px) */}
      <div className="glass-panel border-border/60 flex w-full min-w-0 flex-col items-stretch justify-between gap-3 overflow-hidden rounded-2xl border p-2.5 sm:p-3 xl:flex-row xl:items-center">
        {/* Tier 1: Search bar + Status Filter Tabs */}
        <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2.5 sm:gap-3 md:flex-row md:items-center">
          {/* Search bar (14px / 400 input) */}
          <div className="relative w-full shrink-0 md:w-64 lg:w-72">
            <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, tags... (⌘K)"
              className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-9 w-full rounded-md pr-8 pl-9 text-sm font-normal focus-visible:ring-1 focus-visible:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs (14px / 500 navigation/UI role) */}
          <div className="bg-muted/40 dark:bg-muted/20 border-border/60 no-scrollbar flex w-full min-w-0 touch-pan-x items-center gap-1 overflow-x-auto rounded-xl border p-1 md:w-auto">
            {(["all", "todo", "in_progress", "done"] as const).map((statusKey) => {
              const isSelected = selectedStatus === statusKey
              const count =
                statusKey === "all"
                  ? tasks.length
                  : tasks.filter((t) => t.status === statusKey).length
              const label = statusKey === "all" ? "All" : statusDetails[statusKey].label

              return (
                <button
                  key={statusKey}
                  onClick={() => setSelectedStatus(statusKey)}
                  className={`relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors select-none ${
                    isSelected
                      ? "font-semibold text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <span className="relative z-10">{label}</span>
                  <span
                    className={`relative z-10 rounded-full px-1.5 py-0.5 text-xs font-semibold transition-colors ${
                      isSelected ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                  {isSelected && (
                    <motion.div
                      layoutId="statusFilterPill"
                      className="from-moody-blue-600 to-moody-blue-700 shadow-moody-blue-600/25 absolute inset-0 z-0 rounded-lg bg-linear-to-r shadow-md"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tier 2: Priority Filter & View Switcher */}
        <div className="border-border/40 flex w-full min-w-0 shrink-0 items-center justify-between gap-2 border-t pt-2 xl:w-auto xl:justify-end xl:border-t-0 xl:pt-0">
          {/* Priority filter (12-14px / 500) */}
          <div className="bg-muted/40 dark:bg-muted/20 border-border/60 no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border p-1">
            {(["all", "high", "medium", "low"] as const).map((p) => {
              const isSelected = selectedPriority === p
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`shrink-0 cursor-pointer rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all select-none sm:text-sm ${
                    isSelected
                      ? "bg-moody-blue-600 font-semibold text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>

          <div className="bg-border hidden h-5 w-px sm:block" />

          {/* View Mode Toggle */}
          <div className="bg-muted/40 dark:bg-muted/20 border-border/60 flex shrink-0 items-center gap-0.5 rounded-xl border p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`cursor-pointer rounded-lg p-1.5 transition-all ${
                viewMode === "grid"
                  ? "bg-moody-blue-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`cursor-pointer rounded-lg p-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-moody-blue-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Tasks Display (Grid or List View) */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => {
              const statusInfo = statusDetails[task.status]
              const priorityInfo = priorityDetails[task.priority]
              const StatusIcon = statusInfo.icon
              const PriorityIcon = priorityInfo.icon
              const isDone = task.status === "done"

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2 }}
                  className="h-full min-w-0"
                >
                  <Card className="glass-panel border-border/60 hover:border-moody-blue-500/50 hover:shadow-moody-blue-950/5 dark:hover:shadow-moody-blue-900/10 group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-xl">
                    {/* Top status & priority bar */}
                    <div className="border-border/40 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b p-3.5 pb-2.5 sm:flex-nowrap sm:p-4">
                      {/* Priority Tag (Label 12px / 600) */}
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityInfo.badgeClass}`}
                      >
                        <PriorityIcon className="h-3.5 w-3.5" />
                        <span>{priorityInfo.label} Priority</span>
                      </span>

                      {/* Status Interactive Pill (Label 12px / 600) */}
                      <button
                        onClick={() => cycleStatus(task)}
                        title="Click to cycle status"
                        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all select-none hover:scale-105 ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{statusInfo.label}</span>
                      </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex min-w-0 flex-1 flex-col space-y-2.5 p-3.5 sm:p-4">
                      {/* Interactive Title with Checkbox (Card Heading H4: 18-20px / 600) */}
                      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTaskDone(task.id)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all ${
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border/80 hover:border-moody-blue-500 bg-background/50"
                          }`}
                        >
                          {isDone && <Check className="h-3.5 w-3.5" />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-foreground group-hover:text-moody-blue-600 dark:group-hover:text-moody-blue-400 text-base leading-snug font-semibold tracking-tight wrap-break-word transition-colors sm:text-lg ${
                              isDone ? "text-muted-foreground/70 line-through" : ""
                            }`}
                          >
                            {task.title}
                          </h3>
                        </div>
                      </div>

                      {/* Description (Body Small: 14px / 400 / line-height 1.45) */}
                      {task.description && (
                        <p className="text-muted-foreground line-clamp-3 pl-7 text-sm leading-relaxed font-normal wrap-break-word sm:pl-8">
                          {task.description}
                        </p>
                      )}

                      {/* Tags (Label: 12px / 500) */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex min-w-0 flex-wrap gap-1.5 pt-0.5 pl-7 sm:pl-8">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-moody-blue-500/10 text-moody-blue-700 dark:text-moody-blue-300 border-moody-blue-500/15 shrink-0 cursor-default rounded-md border px-2 py-0.5 text-xs font-medium select-none"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer with Doc Sync & Actions (Metadata: 12px / 400-500) */}
                    <div className="bg-muted/20 border-border/40 text-muted-foreground flex cursor-default flex-wrap items-center justify-between gap-2 border-t p-3 px-3.5 text-xs sm:px-4">
                      {/* Due date or created date */}
                      <div className="flex shrink-0 items-center gap-1.5 text-xs font-normal select-none">
                        <Calendar className="text-moody-blue-500 h-3.5 w-3.5" />
                        {task.dueDate ? (
                          <span
                            className={
                              isPast(new Date(task.dueDate)) && !isDone
                                ? "font-medium text-rose-500"
                                : ""
                            }
                          >
                            Due {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        ) : (
                          <span>{format(new Date(task.createdAt), "MMM d")}</span>
                        )}
                      </div>

                      {/* Right actions: Google Docs Sync pill & Delete button */}
                      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        {/* Doc Sync Toggle Button */}
                        <button
                          onClick={() => toggleSync(task.id)}
                          className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-all select-none ${
                            task.syncedToDocs
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground hover:border-moody-blue-400"
                          }`}
                          title="Toggle Google Docs Sync"
                        >
                          <FileText className="h-3 w-3" />
                          <span>{task.syncedToDocs ? "Docs Synced" : "Sync Pending"}</span>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-muted-foreground shrink-0 cursor-pointer rounded-md p-1 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                          title="Delete Task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* List View (Table-like developer compact view) */
        <div className="glass-panel border-border/60 overflow-hidden rounded-2xl border">
          <div className="divide-border/40 divide-y">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => {
                const statusInfo = statusDetails[task.status]
                const priorityInfo = priorityDetails[task.priority]
                const StatusIcon = statusInfo.icon
                const PriorityIcon = priorityInfo.icon
                const isDone = task.status === "done"

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="hover:bg-muted/30 group flex flex-col justify-between gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:p-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(task.id)}
                        className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border/80 hover:border-moody-blue-500 bg-background/50"
                        }`}
                      >
                        {isDone && <Check className="h-3.5 w-3.5" />}
                      </button>

                      {/* Title & tags (14-16px / 600) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-foreground truncate text-sm font-semibold sm:text-base ${isDone ? "text-muted-foreground/70 line-through" : ""}`}
                          >
                            {task.title}
                          </span>
                          {task.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="bg-moody-blue-500/10 text-moody-blue-700 dark:text-moody-blue-300 cursor-default rounded px-2 py-0.5 text-xs font-medium select-none"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                        {task.description && (
                          <p className="text-muted-foreground max-w-xl truncate text-xs font-normal sm:text-sm">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:flex-nowrap sm:gap-3 sm:self-center">
                      {/* Priority */}
                      <span
                        className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none ${priorityInfo.badgeClass}`}
                      >
                        <PriorityIcon className="h-3.5 w-3.5" />
                        <span className="capitalize">{task.priority}</span>
                      </span>

                      {/* Status */}
                      <button
                        onClick={() => cycleStatus(task)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{statusInfo.label}</span>
                      </button>

                      {/* Due Date */}
                      {task.dueDate && (
                        <span className="text-muted-foreground flex cursor-default items-center gap-1.5 text-xs font-normal select-none">
                          <Calendar className="text-moody-blue-500 h-3.5 w-3.5" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}

                      {/* Doc Sync */}
                      <button
                        onClick={() => toggleSync(task.id)}
                        className={`cursor-pointer rounded border px-2.5 py-0.5 text-xs font-medium transition-all select-none ${
                          task.syncedToDocs
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground hover:border-moody-blue-400"
                        }`}
                      >
                        {task.syncedToDocs ? "Docs Synced" : "Pending"}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-muted-foreground cursor-pointer p-1 transition-colors hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 5. Empty State */}
      {filteredTasks.length === 0 && (
        <div className="glass-panel border-border/60 mx-auto my-8 flex max-w-md flex-col items-center justify-center rounded-3xl border p-12 text-center">
          <div className="bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
            No tasks matching criteria
          </h3>
          <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed font-normal">
            {searchQuery
              ? `No results found for "${searchQuery}". Try clearing your filters or search query.`
              : "No tasks found in this view. Create a new engineering task to get started."}
          </p>
          <div className="mt-5 flex items-center gap-3">
            {searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedStatus("all")
                  setSelectedPriority("all")
                }}
                className="rounded-xl text-sm font-semibold"
              >
                Clear Filters
              </Button>
            )}
            <TaskDialog />
          </div>
        </div>
      )}
    </div>
  )
}
