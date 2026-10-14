"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
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
import { useIntegrationStore, type AutoSyncError } from "@/store/useIntegrationStore"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TaskDialog } from "@/components/task-dialog"
import { TaskTableView } from "@/components/tasks/task-table-view"
import { TaskKanbanView } from "@/components/tasks/task-kanban-view"
import { TaskGridView } from "@/components/tasks/task-grid-view"
import { SmartSyncModal } from "@/components/smart-sync-modal"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useOnboardingStatus } from "@/lib/onboarding"

export function DashboardPage() {
  const { tasks, fetchTasks, isLoading: isLoadingTasks, error: tasksError } = useTaskStore()
  const {
    isConnected,
    targetDocId,
    isSyncing,
    fetchStatus,
    autoSyncCountdown,
    hasPendingSync,
    flushAutoSync,
    autoSyncError,
    cadence,
    statusLoaded,
    statusLoadError,
  } = useIntegrationStore()
  const [syncFeedback, setSyncFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const { isLoaded, isSignedIn, user } = useUser()
  const router = useRouter()
  const { isCompleted: onboardingCompleted } = useOnboardingStatus()
  // First visit after signing up: show the tour before the dashboard
  const needsOnboarding = isLoaded && !!isSignedIn && !onboardingCompleted

  React.useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding")
  }, [needsOnboarding, router])
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

  // A failure of this browser's sync, else one the server recorded for its background syncs
  // (tasks completed via MCP or the API are synced by the server, not by this page)
  const syncProblem: AutoSyncError | null =
    autoSyncError ??
    (cadence.last_sync_error
      ? {
          message: cadence.last_sync_error,
          retryable: cadence.last_sync_error_retryable ?? true,
          failedAt: cadence.last_sync_error_at ?? "",
        }
      : null)

  const handleSyncDailyTable = async () => {
    setSyncFeedback(null)
    // Failures are shown in the sync banner (they also come from background syncs)
    if (await flushAutoSync()) {
      setSyncFeedback({ type: "success", message: "Daily table synced to Google Docs." })
    }
  }

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedStatus, setSelectedStatus] = React.useState<TaskStatus | "all">("all")
  const [highlightsOnly, setHighlightsOnly] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"table" | "kanban" | "grid">("table")
  // The board's columns already split tasks by status, so the status filter is off there
  const isBoard = viewMode === "kanban"
  const activeStatus: TaskStatus | "all" = isBoard ? "all" : selectedStatus

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

    const matchesStatus = activeStatus === "all" || task.status === activeStatus
    const matchesHighlights = !highlightsOnly || task.isCareerHighlight

    return matchesSearch && matchesStatus && matchesHighlights
  })

  // Initial SSR mount & Clerk load guard
  if (!mounted || !isLoaded || needsOnboarding) {
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
          <Card className="border-border space-y-6 border p-6 text-center sm:p-8">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-lg">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
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

            <div className="border-border text-muted-foreground border-t pt-3 text-xs">
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
      <div className="border-border flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              Developer Workspace
            </h1>
            {statusLoadError && !statusLoaded ? (
              <button
                type="button"
                onClick={() => fetchStatus()}
                className="bg-destructive/10 border-destructive/25 text-destructive hover:bg-destructive/15 hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors sm:inline-flex"
                title="Click to try again"
              >
                <AlertCircle className="h-3 w-3" />
                <span>{statusLoadError} · Retry</span>
              </button>
            ) : !statusLoaded ? null : !isConnected ? (
              <Link
                href="/settings"
                className="bg-muted border-border text-muted-foreground hover:text-foreground hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors sm:inline-flex"
                title="Google Docs is not connected. Click to connect in Settings."
              >
                <AlertCircle className="h-3 w-3 text-amber-500" />
                <span>Docs Not Connected</span>
              </Link>
            ) : isSyncing ? (
              <span className="bg-primary/10 border-primary/20 text-primary hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Syncing Docs...</span>
              </span>
            ) : unsyncedCount > 0 ? (
              <span className="hidden items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 sm:inline-flex dark:text-amber-400">
                <Clock className="h-3 w-3" />
                <span>{unsyncedCount} Pending Sync</span>
              </span>
            ) : (
              <span className="bg-success/10 border-success/25 text-success hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-flex">
                <CheckCircle2 className="h-3 w-3" />
                <span>All Synced to Docs</span>
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm font-normal">
            Welcome back,{" "}
            <span className="text-foreground font-medium">
              {user?.fullName ||
                user?.username ||
                user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
                "Developer"}
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
                "border-border hover:border-primary/50 gap-2 text-xs font-medium shadow-xs transition-all sm:text-sm",
                autoSyncCountdown !== null && "border-primary/60 bg-primary/5",
                syncProblem && !isSyncing && "border-destructive/50 bg-destructive/5"
              )}
              title={
                syncProblem
                  ? `Last sync failed: ${syncProblem.message} — click to retry`
                  : autoSyncCountdown !== null
                    ? `Auto-syncing in ${autoSyncCountdown}s — click to sync now`
                    : "Sync Daily Table directly to Google Docs"
              }
            >
              <RefreshCw
                className={cn(
                  "text-primary h-4 w-4",
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
                {isSyncing
                  ? "Syncing"
                  : autoSyncCountdown !== null
                    ? `${autoSyncCountdown}s`
                    : "Sync"}
              </span>
            </Button>
          ) : (
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "border-border hover:border-primary/50 gap-2 text-xs font-medium shadow-xs sm:text-sm"
              )}
              title="Connect Google Docs in Settings to sync"
            >
              <RefreshCw className="text-muted-foreground h-4 w-4" />
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
              <CheckCircle className="text-success h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
            )}
            <span className="text-xs font-medium sm:text-sm">{syncFeedback.message}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {syncFeedback.type === "success" && targetDocId && (
              <a
                href={`https://docs.google.com/document/d/${targetDocId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              >
                <span>Open Google Doc</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-muted-foreground hover:text-foreground ml-2 rounded px-1.5 py-0.5 text-xs"
              aria-label="Dismiss feedback"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Unsynced Tasks / Auto-Sync Callout Banner */}
      {(unsyncedCount > 0 || hasPendingSync || syncProblem) && (
        <div
          className={cn(
            "rounded-lg border p-4 transition-all",
            syncProblem && !isSyncing
              ? "border-destructive/30 bg-destructive/5"
              : "border-primary/25 bg-primary/5"
          )}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 rounded-full",
                    isSyncing
                      ? "bg-primary animate-spin"
                      : syncProblem
                        ? "bg-destructive"
                        : autoSyncCountdown !== null
                          ? "animate-ping bg-amber-500"
                          : "bg-primary animate-pulse"
                  )}
                />
                <h2 className="text-foreground text-sm font-semibold">
                  {isSyncing
                    ? "Syncing changes with Google Docs..."
                    : syncProblem
                      ? syncProblem.retryable
                        ? "Auto-sync failed · retrying automatically"
                        : "Auto-sync paused · action needed"
                      : autoSyncCountdown !== null
                        ? `${unsyncedCount} update${unsyncedCount > 1 ? "s" : ""} · Auto-syncing in ${autoSyncCountdown}s`
                        : `${unsyncedCount} Unsynced Contribution${unsyncedCount > 1 ? "s" : ""} Ready for Ledger`}
                </h2>
              </div>
              <p className="text-muted-foreground text-xs">
                {syncProblem && !isSyncing
                  ? `${syncProblem.message.replace(/\.$/, "")}. Your changes are saved${
                      syncProblem.retryable
                        ? " and will sync on the next attempt."
                        : "; fix this, then click Retry now."
                    }`
                  : isConnected
                    ? autoSyncCountdown !== null
                      ? "Batching updates every 30 seconds to respect Google Docs rate limits. Click Sync Now to push immediately."
                      : "Tasks logged or modified can be pushed directly into your daily table anytime."
                    : "You've logged tasks locally. Connect your Google Doc in Settings to immediately synchronize your daily table."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {isConnected ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSyncDailyTable}
                    disabled={isSyncing}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                    <span>
                      {isSyncing
                        ? "Syncing..."
                        : syncProblem
                          ? "Retry now"
                          : autoSyncCountdown !== null
                            ? "Sync Now"
                            : `Sync ${unsyncedCount} Task${unsyncedCount > 1 ? "s" : ""}`}
                    </span>
                  </Button>
                  {syncProblem && !syncProblem.retryable && (
                    <Link
                      href="/settings"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-8 text-xs"
                      )}
                    >
                      Open Settings
                    </Link>
                  )}
                  {targetDocId && (
                    <a
                      href={`https://docs.google.com/document/d/${targetDocId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-8 gap-1.5 text-xs"
                      )}
                    >
                      <span>Open Doc</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              ) : (
                <Link
                  href="/settings"
                  className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 text-xs")}
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
          onClick={() => setSelectedStatus(activeStatus === "done" ? "all" : "done")}
          className={cn(
            "group relative cursor-pointer space-y-2.5 overflow-hidden p-4 transition-all duration-300 select-none",
            "hover:border-primary/50 hover:bg-primary/2 hover:-translate-y-1 hover:shadow-md",
            activeStatus === "done" && "ring-primary border-primary/60 bg-primary/5 ring-2"
          )}
          title="Click to filter by completed tasks"
        >
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="group-hover:text-foreground font-semibold tracking-wider uppercase transition-colors">
              Completion
            </span>
            <Sparkles className="text-primary h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {progressPercentage}%
            </span>
            <span className="text-muted-foreground text-xs">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-110"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </Card>

        {/* In Progress */}
        <Card
          onClick={() => setSelectedStatus(activeStatus === "in_progress" ? "all" : "in_progress")}
          className={cn(
            "group relative cursor-pointer space-y-2.5 overflow-hidden p-4 transition-all duration-300 select-none",
            "hover:-translate-y-1 hover:border-blue-500/50 hover:bg-blue-500/2 hover:shadow-md",
            activeStatus === "in_progress" &&
              "border-blue-500/60 bg-blue-500/5 ring-2 ring-blue-500"
          )}
          title="Click to filter by in-progress sprint tasks"
        >
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="group-hover:text-foreground font-semibold tracking-wider uppercase transition-colors">
              In Progress
            </span>
            <Clock className="text-status-progress h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {inProgressTasks}
            </span>
            <span className="text-muted-foreground text-xs">active sprint tasks</span>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="bg-status-progress h-1.5 w-1.5 animate-pulse rounded-full" />
            <span>Active coding</span>
          </p>
        </Card>

        {/* Career Highlights Starred */}
        <Card
          onClick={() => setHighlightsOnly(!highlightsOnly)}
          className={cn(
            "group relative cursor-pointer space-y-2.5 overflow-hidden p-4 transition-all duration-300 select-none",
            "hover:-translate-y-1 hover:border-amber-500/50 hover:bg-amber-500/2 hover:shadow-md",
            highlightsOnly && "border-amber-500/60 bg-amber-500/5 ring-2 ring-amber-500"
          )}
          title="Click to toggle career highlight dossier items"
        >
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="group-hover:text-foreground font-semibold tracking-wider uppercase transition-colors">
              Career Highlights
            </span>
            <Star className="text-highlight fill-highlight h-4 w-4 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {careerHighlightsCount}
            </span>
            <span className="text-muted-foreground text-xs">dossier items</span>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="bg-highlight h-1.5 w-1.5 rounded-full" />
            <span>Target for appraisal</span>
          </p>
        </Card>

        {/* Docs Synced */}
        <Card
          onClick={isConnected && unsyncedCount > 0 ? handleSyncDailyTable : undefined}
          className={cn(
            "group relative space-y-2.5 overflow-hidden p-4 transition-all duration-300 select-none",
            "hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-emerald-500/2 hover:shadow-md",
            isConnected && unsyncedCount > 0 ? "cursor-pointer" : "cursor-default"
          )}
          title={
            isConnected && unsyncedCount > 0
              ? "Click to sync pending updates to Google Docs"
              : "Google Docs synchronization status"
          }
        >
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span className="group-hover:text-foreground font-semibold tracking-wider uppercase transition-colors">
              Docs Synced
            </span>
            <FileText className="text-success h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-foreground text-2xl font-bold tracking-tight">
              {syncedDocsCount}
            </span>
            <span className="text-muted-foreground text-xs">/{totalTasks} synced records</span>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                !isConnected
                  ? "bg-muted-foreground"
                  : unsyncedCount === 0
                    ? "bg-success"
                    : "animate-pulse bg-amber-500"
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
            <div className="bg-highlight-soft border-highlight/30 flex items-center justify-between rounded-lg border p-3.5 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Star className="text-highlight fill-highlight h-4 w-4 shrink-0 animate-pulse" />
                <div>
                  <h2 className="text-foreground text-sm font-semibold">Career evidence</h2>
                  <p className="text-muted-foreground text-xs">
                    Showing {filteredTasks.length} starred appraisal-worthy task(s) for your impact
                    portfolio.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHighlightsOnly(false)}
                className="hover:bg-highlight/10 h-7 cursor-pointer text-xs"
              >
                Clear filter
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Filter, Search & View Controls Bar */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Search bar */}
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contribution, project..."
            className="h-9 pl-9 text-xs"
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
        <div className="bg-muted no-scrollbar flex items-center gap-1 overflow-x-auto rounded-md p-1">
          {!isBoard &&
            (["all", "todo", "in_progress", "done", "blocked"] as const).map((statusKey) => {
              const isSelected = activeStatus === statusKey
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
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all select-none",
                    isSelected
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{labelMap[statusKey]}</span>
                  <span className="text-muted-foreground text-[10px]">({count})</span>
                </button>
              )
            })}

          {/* Highlights toggle */}
          <button
            onClick={() => setHighlightsOnly(!highlightsOnly)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all select-none",
              highlightsOnly
                ? "bg-highlight-soft text-foreground border-highlight/40 border font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-3 w-3", highlightsOnly && "fill-highlight text-highlight")} />
            <span>Highlights</span>
          </button>
        </div>

        {/* View Switcher: Table / Board / Grid */}
        <div className="bg-muted flex shrink-0 items-center gap-0.5 self-start rounded-md p-1 sm:self-auto">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors",
              viewMode === "table"
                ? "bg-card text-foreground font-semibold shadow-xs"
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
              "flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors",
              viewMode === "kanban"
                ? "bg-card text-foreground font-semibold shadow-xs"
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
              "flex items-center gap-1 rounded-md p-1.5 text-xs transition-colors",
              viewMode === "grid"
                ? "bg-card text-foreground font-semibold shadow-xs"
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
          key={`${viewMode}-${activeStatus}-${highlightsOnly}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="w-full"
        >
          {tasks.length === 0 && tasksError ? (
            <Card className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle className="text-destructive h-8 w-8" />
              <div className="space-y-1">
                <h3 className="text-foreground text-base font-semibold">
                  Couldn&apos;t load your tasks
                </h3>
                <p className="text-muted-foreground max-w-sm text-sm">{tasksError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchTasks()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try again</span>
              </Button>
            </Card>
          ) : tasks.length === 0 && isLoadingTasks ? (
            <Card className="flex min-h-72 items-center justify-center p-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            </Card>
          ) : viewMode === "table" ? (
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
