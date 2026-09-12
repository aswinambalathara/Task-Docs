"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format, formatDistanceToNow, isPast } from "date-fns"
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  CircleDashed, 
  AlertCircle,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  FileText,
  ExternalLink,
  Trash2,
  RefreshCw,
  Flame,
  ShieldCheck,
  Check,
  ArrowUpDown,
  Tag as TagIcon
} from "lucide-react"

import { useTaskStore, Task, TaskStatus, TaskPriority } from "@/store/useTaskStore"
import { TaskDialog } from "@/components/task-dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const statusDetails: Record<TaskStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  todo: { 
    label: "To Do", 
    icon: CircleDashed, 
    color: "text-slate-500 dark:text-slate-400", 
    bg: "bg-slate-500/10 border-slate-500/20" 
  },
  in_progress: { 
    label: "In Progress", 
    icon: Clock, 
    color: "text-moody-blue-600 dark:text-moody-blue-400", 
    bg: "bg-moody-blue-500/10 border-moody-blue-500/25" 
  },
  done: { 
    label: "Done", 
    icon: CheckCircle2, 
    color: "text-emerald-600 dark:text-emerald-400", 
    bg: "bg-emerald-500/10 border-emerald-500/25" 
  },
}

const priorityDetails: Record<TaskPriority, { label: string; icon: React.ElementType; badgeClass: string }> = {
  low: { 
    label: "Low", 
    icon: ShieldCheck, 
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border-slate-200 dark:border-slate-700" 
  },
  medium: { 
    label: "Medium", 
    icon: Clock, 
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" 
  },
  high: { 
    label: "High", 
    icon: Flame, 
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" 
  },
}

export default function DashboardPage() {
  const { tasks, updateTask, deleteTask, toggleTaskDone, toggleSync } = useTaskStore()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatus | "all">("all")
  const [selectedPriority, setSelectedPriority] = React.useState<TaskPriority | "all">("all")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [isSyncing, setIsSyncing] = React.useState(false)

  // Metrics computation
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "done").length
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length
  const todoTasks = tasks.filter((t) => t.status === "todo").length
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
      syncedToDocs: updated === "done" ? true : task.syncedToDocs 
    })
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-[1.15]">
              Developer <span className="text-transparent bg-clip-text bg-linear-to-r from-moody-blue-600 via-moody-blue-500 to-moody-blue-400">Workspace</span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Docs Synced
            </span>
          </div>
          <p className="text-sm sm:text-base font-normal text-muted-foreground leading-relaxed">
            Track implementation progress and stream verified task contributions directly into Google Docs via MCP.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-9 px-3 text-sm font-semibold rounded-xl glass-panel border-border/80 hover:bg-muted/60 transition-all shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-moody-blue-600 dark:text-moody-blue-400 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Docs"}</span>
          </Button>

          <TaskDialog />
        </div>
      </div>

      {/* 2. Glassmorphic Metrics HUD (Grid-safe on 320px screens) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Tasks & Completion Progress */}
        <div className="glass-panel p-3 sm:p-4 lg:p-5 rounded-2xl border border-border/60 shadow-xs relative overflow-hidden group hover:border-moody-blue-500/40 transition-colors min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Completion Rate</span>
            <div className="p-1.5 rounded-xl bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{progressPercentage}%</span>
            <span className="text-xs sm:text-sm text-muted-foreground font-normal truncate">{completedTasks}/{totalTasks} tasks</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 sm:mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-moody-blue-600 to-moody-blue-400 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* In Progress */}
        <div className="glass-panel p-3 sm:p-4 lg:p-5 rounded-2xl border border-border/60 shadow-xs group hover:border-moody-blue-500/40 transition-colors min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">In Progress</span>
            <div className="p-1.5 rounded-xl bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{inProgressTasks}</span>
            <span className="text-xs sm:text-sm text-muted-foreground font-normal truncate">active sprints</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-2.5 sm:mt-3 flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-moody-blue-500 shrink-0" />
            <span className="truncate">Currently coding</span>
          </p>
        </div>

        {/* Shipped / Done */}
        <div className="glass-panel p-3 sm:p-4 lg:p-5 rounded-2xl border border-border/60 shadow-xs group hover:border-emerald-500/40 transition-colors min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Shipped / Done</span>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{completedTasks}</span>
            <span className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium truncate">verified</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-2.5 sm:mt-3 flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">In changelog</span>
          </p>
        </div>

        {/* Docs Sync Health */}
        <div className="glass-panel p-3 sm:p-4 lg:p-5 rounded-2xl border border-border/60 shadow-xs group hover:border-moody-blue-500/40 transition-colors min-w-0">
          <div className="flex justify-between items-start gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Docs Sync</span>
            <div className="p-1.5 rounded-xl bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1 sm:gap-2 flex-wrap">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{syncedDocsCount}</span>
            <span className="text-xs sm:text-sm text-muted-foreground font-normal truncate">synced items</span>
          </div>
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2.5 sm:mt-3 flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">Live sync active</span>
          </p>
        </div>
      </div>

      {/* 3. Filter, Search & View Controls Bar (Adaptive layout that never overflows at 320px) */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between glass-panel p-2.5 sm:p-3 rounded-2xl border border-border/60 w-full min-w-0 overflow-hidden">
        
        {/* Tier 1: Search bar + Status Filter Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          {/* Search bar (14px / 400 input) */}
          <div className="relative w-full md:w-64 lg:w-72 shrink-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, tags... (⌘K)"
              className="pl-9 pr-8 h-9 text-sm font-normal rounded-md bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs (14px / 500 navigation/UI role) */}
          <div className="flex items-center gap-1 bg-muted/40 dark:bg-muted/20 rounded-xl p-1 border border-border/60 overflow-x-auto no-scrollbar w-full md:w-auto min-w-0 touch-pan-x">
            {(["all", "todo", "in_progress", "done"] as const).map((statusKey) => {
              const isSelected = selectedStatus === statusKey
              const count = statusKey === "all" 
                ? tasks.length 
                : tasks.filter((t) => t.status === statusKey).length
              const label = statusKey === "all" ? "All" : statusDetails[statusKey].label

              return (
                <button
                  key={statusKey}
                  onClick={() => setSelectedStatus(statusKey)}
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer select-none shrink-0 ${
                    isSelected
                      ? "text-white font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <span className="relative z-10">{label}</span>
                  <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                    isSelected 
                      ? "bg-white/25 text-white" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                  {isSelected && (
                    <motion.div
                      layoutId="statusFilterPill"
                      className="absolute inset-0 rounded-lg bg-linear-to-r from-moody-blue-600 to-moody-blue-700 shadow-md shadow-moody-blue-600/25 z-0"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tier 2: Priority Filter & View Switcher */}
        <div className="flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-border/40 min-w-0">
          {/* Priority filter (12-14px / 500) */}
          <div className="flex items-center gap-1 bg-muted/40 dark:bg-muted/20 rounded-xl p-1 border border-border/60 min-w-0 overflow-x-auto no-scrollbar">
            {(["all", "high", "medium", "low"] as const).map((p) => {
              const isSelected = selectedPriority === p
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-medium capitalize transition-all cursor-pointer select-none shrink-0 ${
                    isSelected
                      ? "bg-moody-blue-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-0.5 bg-muted/40 dark:bg-muted/20 rounded-xl p-1 border border-border/60 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid" 
                  ? "bg-moody-blue-600 text-white shadow-xs" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list" 
                  ? "bg-moody-blue-600 text-white shadow-xs" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* 4. Tasks Display (Grid or List View) */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">

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
                  <Card className="h-full flex flex-col rounded-2xl glass-panel border-border/60 hover:border-moody-blue-500/50 hover:shadow-xl hover:shadow-moody-blue-950/5 dark:hover:shadow-moody-blue-900/10 transition-all duration-300 overflow-hidden group min-w-0">
                    
                    {/* Top status & priority bar */}
                    <div className="p-3.5 sm:p-4 pb-2.5 flex items-center justify-between gap-2 border-b border-border/40 flex-wrap sm:flex-nowrap min-w-0">
                      
                      {/* Priority Tag (Label 12px / 600) */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${priorityInfo.badgeClass}`}>
                        <PriorityIcon className="w-3.5 h-3.5" />
                        <span>{priorityInfo.label} Priority</span>
                      </span>

                      {/* Status Interactive Pill (Label 12px / 600) */}
                      <button
                        onClick={() => cycleStatus(task)}
                        title="Click to cycle status"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 cursor-pointer select-none shrink-0 ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusInfo.label}</span>
                      </button>
                    </div>

                    {/* Body Content */}
                    <div className="p-3.5 sm:p-4 space-y-2.5 flex-1 flex flex-col min-w-0">
                      
                      {/* Interactive Title with Checkbox (Card Heading H4: 18-20px / 600) */}
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleTaskDone(task.id)}
                          className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                            isDone 
                              ? "bg-emerald-500 border-emerald-500 text-white" 
                              : "border-border/80 hover:border-moody-blue-500 bg-background/50"
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-base sm:text-lg leading-snug tracking-tight text-foreground group-hover:text-moody-blue-600 dark:group-hover:text-moody-blue-400 transition-colors wrap-break-word ${
                            isDone ? "line-through text-muted-foreground/70" : ""
                          }`}>
                            {task.title}
                          </h3>
                        </div>
                      </div>

                      {/* Description (Body Small: 14px / 400 / line-height 1.45) */}
                      {task.description && (
                        <p className="text-sm font-normal text-muted-foreground leading-relaxed line-clamp-3 pl-7 sm:pl-8 wrap-break-word">
                          {task.description}
                        </p>
                      )}

                      {/* Tags (Label: 12px / 500) */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-7 sm:pl-8 pt-0.5 min-w-0">
                          {task.tags.map((tag) => (
                            <span 
                              key={tag}
                              className="px-2 py-0.5 rounded-md text-xs font-medium bg-moody-blue-500/10 text-moody-blue-700 dark:text-moody-blue-300 border border-moody-blue-500/15 cursor-default select-none shrink-0"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>

                    {/* Footer with Doc Sync & Actions (Metadata: 12px / 400-500) */}
                    <div className="p-3 px-3.5 sm:px-4 bg-muted/20 border-t border-border/40 flex items-center justify-between gap-2 text-xs text-muted-foreground cursor-default flex-wrap">
                      
                      {/* Due date or created date */}
                      <div className="flex items-center gap-1.5 text-xs font-normal select-none shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-moody-blue-500" />
                        {task.dueDate ? (
                          <span className={isPast(new Date(task.dueDate)) && !isDone ? "text-rose-500 font-medium" : ""}>
                            Due {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        ) : (
                          <span>{format(new Date(task.createdAt), "MMM d")}</span>
                        )}
                      </div>

                      {/* Right actions: Google Docs Sync pill & Delete button */}
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Doc Sync Toggle Button */}
                        <button
                          onClick={() => toggleSync(task.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer select-none shrink-0 ${
                            task.syncedToDocs
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-muted text-muted-foreground hover:border-moody-blue-400"
                          }`}
                          title="Toggle Google Docs Sync"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{task.syncedToDocs ? "Docs Synced" : "Sync Pending"}</span>
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="glass-panel rounded-2xl border border-border/60 overflow-hidden">
          <div className="divide-y divide-border/40">
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
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(task.id)}
                        className={`flex items-center justify-center w-5 h-5 rounded-lg border shrink-0 transition-all cursor-pointer ${
                          isDone 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-border/80 hover:border-moody-blue-500 bg-background/50"
                        }`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5" />}
                      </button>

                      {/* Title & tags (14-16px / 600) */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm sm:text-base font-semibold text-foreground truncate ${isDone ? "line-through text-muted-foreground/70" : ""}`}>
                            {task.title}
                          </span>
                          {task.tags?.map((tag) => (
                            <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded bg-moody-blue-500/10 text-moody-blue-700 dark:text-moody-blue-300 cursor-default select-none">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        {task.description && (
                          <p className="text-xs sm:text-sm font-normal text-muted-foreground truncate max-w-xl">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start sm:self-center flex-wrap sm:flex-nowrap">
                      {/* Priority */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-default select-none ${priorityInfo.badgeClass}`}>
                        <PriorityIcon className="w-3.5 h-3.5" />
                        <span className="capitalize">{task.priority}</span>
                      </span>

                      {/* Status */}
                      <button
                        onClick={() => cycleStatus(task)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer select-none ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusInfo.label}</span>
                      </button>

                      {/* Due Date */}
                      {task.dueDate && (
                        <span className="text-xs font-normal text-muted-foreground flex items-center gap-1.5 cursor-default select-none">
                          <Calendar className="w-3.5 h-3.5 text-moody-blue-500" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}

                      {/* Doc Sync */}
                      <button
                        onClick={() => toggleSync(task.id)}
                        className={`text-xs font-medium px-2.5 py-0.5 rounded border transition-all cursor-pointer select-none ${
                          task.syncedToDocs 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                            : "bg-muted text-muted-foreground hover:border-moody-blue-400"
                        }`}
                      >
                        {task.syncedToDocs ? "Docs Synced" : "Pending"}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center justify-center border border-border/60 max-w-md mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-400 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">No tasks matching criteria</h3>
          <p className="text-sm font-normal text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
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
                className="text-sm font-semibold rounded-xl"
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
