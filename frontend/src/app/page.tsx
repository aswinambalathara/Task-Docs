"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  Clock,
  Search,
  LayoutGrid,
  Table2,
  Columns3,
  Sparkles,
  FileText,
  ShieldCheck,
  Lock,
  ArrowRight,
  Star,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

import { useTaskStore, TaskStatus } from "@/store/useTaskStore"
import { useIntegrationStore } from "@/store/useIntegrationStore"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { TaskDialog } from "@/components/task-dialog"
import { TaskTableView } from "@/components/tasks/task-table-view"
import { TaskKanbanView } from "@/components/tasks/task-kanban-view"
import { TaskGridView } from "@/components/tasks/task-grid-view"
import { SmartSyncModal } from "@/components/smart-sync-modal"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { CareerStar } from "@/components/ui/career-star"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const { tasks, fetchTasks, toggleCareerHighlight } = useTaskStore()
  const {
    isConnected,
    targetDocId,
    isSyncing,
    syncDailyTable,
    fetchStatus,
    autoSyncCountdown,
    hasPendingSync,
    flushAutoSync,
  } = useIntegrationStore()
  const [syncFeedback, setSyncFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const { isLoaded, isSignedIn, user } = useUser()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  React.useEffect(() => {
    if (isSignedIn) {
      fetchTasks()
      fetchStatus()
    }
  }, [fetchTasks, fetchStatus, isSignedIn])

  const handleSyncDailyTable = async () => {
    setSyncFeedback(null)
    await flushAutoSync()
  }

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatus | "all">("all")
  const [highlightsOnly, setHighlightsOnly] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"table" | "kanban" | "grid">("table")

  // Metrics computation
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "done").length
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length
  const careerHighlightsCount = tasks.filter((t) => t.isCareerHighlight).length
  const syncedDocsCount = tasks.filter((t) => t.syncedToDocs).length
  const unsyncedCount = totalTasks - syncedDocsCount
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Filter & Search Logic
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.project && task.project.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.area && task.area.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.outcome && task.outcome.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (task.tags && task.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus
    const matchesHighlights = !highlightsOnly || task.isCareerHighlight

    return matchesSearch && matchesStatus && matchesHighlights
  })

  // Initial SSR mount & Clerk load guard
  if (!mounted || !isLoaded) {
    return (
      <div className="container mx-auto flex max-w-7xl items-center justify-center px-4 py-16">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  // Unauthenticated Protected State
  if (!isSignedIn) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <Card className="border border-border p-6 text-center space-y-6 sm:p-8">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-lg">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Developer Workspace</span>
                </div>
                <h1 className="text-foreground text-2xl font-bold tracking-tight">
                  Sign in to your Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">
                  Manage sprint backlogs, log impact evidence, and sync directly to Google Docs.
                </p>
              </div>
            </div>

            <div>
              <Link href="/sign-in" className="block w-full">
                <Button className="w-full gap-2">
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="border-t border-border pt-3 text-xs text-muted-foreground">
              Stateless RS256 JWT authenticated • Strict Multi-Tenancy
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              Developer Workspace
            </h1>
            {!isConnected ? (
              <Link
                href="/settings"
                className="hidden items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors sm:inline-flex"
                title="Google Docs is not connected. Click to connect in Settings."
              >
                <AlertCircle className="h-3 w-3 text-amber-500" />
                <span>Docs Not Connected</span>
              </Link>
            ) : isSyncing ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary sm:inline-flex">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Syncing Docs...</span>
              </span>
            ) : unsyncedCount > 0 ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 sm:inline-flex">
                <Clock className="h-3 w-3" />
                <span>{unsyncedCount} Pending Sync</span>
              </span>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-full bg-success/10 border border-success/25 px-2.5 py-0.5 text-xs font-medium text-success sm:inline-flex">
                <CheckCircle2 className="h-3 w-3" />
                <span>All Synced to Docs</span>
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm font-normal">
            Welcome back,{" "}
            <span className="text-foreground font-medium">
              {user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Developer"}
            </span>
            . Track engineering milestones and synchronize impact ledgers.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Direct Daily Table Sync Button (Instant, Unlimited, No AI limit) */}
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncDailyTable}
              disabled={isSyncing}
              className={cn(
                "gap-2 border-border shadow-xs hover:border-primary/50 text-xs sm:text-sm font-medium transition-all",
                autoSyncCountdown !== null && "border-primary/60 bg-primary/5"
              )}
              title={
                autoSyncCountdown !== null
                  ? `Auto-syncing in ${autoSyncCountdown}s — click to sync now`
                  : "Sync Daily Table directly to Google Docs"
              }
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 text-primary",
                  isSyncing && "animate-spin",
                  !isSyncing && autoSyncCountdown !== null && "animate-pulse"
                )}
              />
              <span className="hidden sm:inline">
                {isSyncing
                  ? "Syncing..."
                  : autoSyncCountdown !== null
                  ? `Sync Now (${autoSyncCountdown}s)`
                  : "Sync Daily Table"}
              </span>
              <span className="sm:hidden">
                {isSyncing ? "Syncing" : autoSyncCountdown !== null ? `${autoSyncCountdown}s` : "Sync"}
              </span>
            </Button>
          ) : (
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2 border-border shadow-xs hover:border-primary/50 text-xs sm:text-sm font-medium"
              )}
              title="Connect Google Docs in Settings to sync"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span>Connect Docs</span>
            </Link>
          )}

          {/* Smart Sync Modal Trigger */}
          <SmartSyncModal />

          {/* New Task Dialog */}
          <TaskDialog />
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border p-3.5 text-sm transition-all",
            syncFeedback.type === "success"
              ? "border-success/30 bg-success/10 text-foreground"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-medium">{syncFeedback.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {syncFeedback.type === "success" && targetDocId && (
              <a
                href={`https://docs.google.com/document/d/${targetDocId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
              >
                <span>Open Google Doc</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-xs text-muted-foreground hover:text-foreground ml-2 px-1.5 py-0.5 rounded"
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Unsynced Tasks / Auto-Sync Callout Banner */}
      {(unsyncedCount > 0 || hasPendingSync) && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    isSyncing
                      ? "bg-primary animate-spin"
                      : autoSyncCountdown !== null
                      ? "bg-amber-500 animate-ping"
                      : "bg-primary animate-pulse"
                  )}
                />
                <h2 className="text-sm font-semibold text-foreground">
                  {isSyncing
                    ? "Syncing changes with Google Docs..."
                    : autoSyncCountdown !== null
                    ? `${unsyncedCount} update${unsyncedCount > 1 ? "s" : ""} · Auto-syncing in ${autoSyncCountdown}s`
                    : `${unsyncedCount} Unsynced Contribution${unsyncedCount > 1 ? "s" : ""} Ready for Ledger`}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {isConnected
                  ? autoSyncCountdown !== null
                    ? "Batching updates every 30 seconds to respect Google Docs rate limits. Click Sync Now to push immediately."
                    : "Tasks logged or modified can be pushed directly into your daily table anytime."
                  : "You've logged tasks locally. Connect your Google Doc in Settings to immediately synchronize your daily table."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isConnected ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSyncDailyTable}
                    disabled={isSyncing}
                    className="gap-1.5 text-xs h-8"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                    <span>
                      {isSyncing
                        ? "Syncing..."
                        : autoSyncCountdown !== null
                        ? "Sync Now"
                        : `Sync ${unsyncedCount} Task${unsyncedCount > 1 ? "s" : ""}`}
                    </span>
                  </Button>
                  {targetDocId && (
                    <a
                      href={`https://docs.google.com/document/d/${targetDocId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs h-8")}
                    >
                      <span>Open Doc</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              ) : (
                <Link
                  href="/settings"
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5 text-xs h-8")}
                >
                  <span>Connect Google Docs</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Metrics HUD (Neutral First) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {/* Completion Rate */}
        <Card
          onClick={() => setSelectedStatus(selectedStatus === "done" ? "all" : "done")}
          className={cn(
            "group relative overflow-hidden p-4 space-y-2.5 transition-all duration-300 cursor-pointer select-none",
            "hover:-translate-y-1 hover:shadow-md hover:border-primary/50 hover:bg-primary/2",
            selectedStatus === "done" && "ring-2 ring-primary border-primary/60 bg-primary/5"
          )}
          title="Click to filter by completed tasks"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider group-hover:text-foreground transition-colors">
              Completion
            </span>
            <Sparkles className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {progressPercentage}%
            </span>
            <span className="text-muted-foreground text-xs">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out group-hover:brightness-110"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </Card>

        {/* In Progress */}
        <Card
          onClick={() => setSelectedStatus(selectedStatus === "in_progress" ? "all" : "in_progress")}
          className={cn(
            "group relative overflow-hidden p-4 space-y-2.5 transition-all duration-300 cursor-pointer select-none",
            "hover:-translate-y-1 hover:shadow-md hover:border-blue-500/50 hover:bg-blue-500/2",
            selectedStatus === "in_progress" && "ring-2 ring-blue-500 border-blue-500/60 bg-blue-500/5"
          )}
          title="Click to filter by in-progress sprint tasks"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider group-hover:text-foreground transition-colors">
              In Progress
            </span>
            <Clock className="h-4 w-4 text-status-progress transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {inProgressTasks}
            </span>
            <span className="text-muted-foreground text-xs">active sprint tasks</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-status-progress animate-pulse" />
            <span>Active coding</span>
          </p>
        </Card>

        {/* Career Highlights Starred */}
        <Card
          onClick={() => setHighlightsOnly(!highlightsOnly)}
          className={cn(
            "group relative overflow-hidden p-4 space-y-2.5 transition-all duration-300 cursor-pointer select-none",
            "hover:-translate-y-1 hover:shadow-md hover:border-amber-500/50 hover:bg-amber-500/2",
            highlightsOnly && "ring-2 ring-amber-500 border-amber-500/60 bg-amber-500/5"
          )}
          title="Click to toggle career highlight dossier items"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider group-hover:text-foreground transition-colors">
              Career Highlights
            </span>
            <Star className="h-4 w-4 text-highlight fill-highlight transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {careerHighlightsCount}
            </span>
            <span className="text-xs text-muted-foreground">dossier items</span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-highlight" />
            <span>Target for appraisal</span>
          </p>
        </Card>

        {/* Docs Synced */}
        <Card
          onClick={isConnected && unsyncedCount > 0 ? handleSyncDailyTable : undefined}
          className={cn(
            "group relative overflow-hidden p-4 space-y-2.5 transition-all duration-300 select-none",
            "hover:-translate-y-1 hover:shadow-md hover:border-emerald-500/50 hover:bg-emerald-500/2",
            isConnected && unsyncedCount > 0 ? "cursor-pointer" : "cursor-default"
          )}
          title={
            isConnected && unsyncedCount > 0
              ? "Click to sync pending updates to Google Docs"
              : "Google Docs synchronization status"
          }
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider group-hover:text-foreground transition-colors">
              Docs Synced
            </span>
            <FileText className="h-4 w-4 text-success transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {syncedDocsCount}
            </span>
            <span className="text-muted-foreground text-xs">
              /{totalTasks} synced records
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                !isConnected
                  ? "bg-muted-foreground"
                  : unsyncedCount === 0
                  ? "bg-success"
                  : "bg-amber-500 animate-pulse"
              )}
            />
            <span>
              {!isConnected
                ? "Ledger not connected"
                : unsyncedCount === 0
                ? "Ledger fully in sync"
                : `${unsyncedCount} pending auto-sync`}
            </span>
          </p>
        </Card>
      </div>

      {/* Career Evidence Banner (when Highlights Filter active) */}
      <AnimatePresence>
        {highlightsOnly && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="bg-highlight-soft border border-highlight/30 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <Star className="h-4 w-4 text-highlight fill-highlight shrink-0 animate-pulse" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Career evidence</h2>
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredTasks.length} starred appraisal-worthy task(s) for your impact portfolio.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHighlightsOnly(false)}
                className="text-xs h-7 hover:bg-highlight/10 cursor-pointer"
              >
                Clear filter
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filter, Search & View Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-2 bg-card sm:flex-row sm:items-center sm:justify-between">
        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contribution, project..."
            className="pl-9 h-9 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Segmented Control */}
        <div className="bg-muted rounded-md p-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(["all", "todo", "in_progress", "done", "blocked"] as const).map((statusKey) => {
            const isSelected = selectedStatus === statusKey
            const count =
              statusKey === "all"
                ? tasks.length
                : tasks.filter((t) => t.status === statusKey).length
            const labelMap: Record<string, string> = {
              all: "All",
              todo: "To do",
              in_progress: "In progress",
              done: "Done",
              blocked: "Blocked",
            }

            return (
              <button
                key={statusKey}
                onClick={() => setSelectedStatus(statusKey)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap select-none flex items-center gap-1.5",
                  isSelected
                    ? "bg-card shadow-xs text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{labelMap[statusKey]}</span>
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </button>
            )
          })}

          {/* Highlights toggle */}
          <button
            onClick={() => setHighlightsOnly(!highlightsOnly)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap select-none flex items-center gap-1",
              highlightsOnly
                ? "bg-highlight-soft text-foreground font-semibold border border-highlight/40"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-3 w-3", highlightsOnly && "fill-highlight text-highlight")} />
            <span>Highlights</span>
          </button>
        </div>

        {/* View Switcher: Table / Board / Grid */}
        <div className="bg-muted rounded-md p-1 flex items-center gap-0.5 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "rounded-md p-1.5 text-xs transition-colors flex items-center gap-1",
              viewMode === "table"
                ? "bg-card shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Table View"
          >
            <Table2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Table</span>
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={cn(
              "rounded-md p-1.5 text-xs transition-colors flex items-center gap-1",
              viewMode === "kanban"
                ? "bg-card shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Board View"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Board</span>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 text-xs transition-colors flex items-center gap-1",
              viewMode === "grid"
                ? "bg-card shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* 4. Tasks View Renders with smooth animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewMode}-${selectedStatus}-${highlightsOnly}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full"
        >
          {viewMode === "table" ? (
            <TaskTableView tasks={filteredTasks} />
          ) : viewMode === "kanban" ? (
            <TaskKanbanView tasks={filteredTasks} />
          ) : (
            <TaskGridView tasks={filteredTasks} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
