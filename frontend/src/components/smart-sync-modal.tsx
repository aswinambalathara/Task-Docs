"use client"

import * as React from "react"
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FilePlus2,
  Loader2,
  FileText,
} from "lucide-react"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useIntegrationStore } from "@/store/useIntegrationStore"
import { useTaskStore } from "@/store/useTaskStore"
import { cn } from "@/lib/utils"

interface SmartSyncModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

function SmartSyncModalContent({ onClose }: { onClose: () => void }) {
  const {
    isConnected,
    targetDocId,
    targetDocTitle,
    cadence,
    remainingManualSyncsWeek,
    remainingManualSyncsMonth,
    isSyncing,
    isCreatingDoc,
    fetchStatus,
    syncDocs,
    createGoogleDoc,
    fetchAISummary,
  } = useIntegrationStore()

  const { tasks, fetchTasks } = useTaskStore()

  const [scope, setScope] = React.useState<"daily_table" | "all" | "weekly" | "monthly">("daily_table")
  const [includeContributions, setIncludeContributions] = React.useState(true)
  const [aiPreview, setAiPreview] = React.useState<string | null>(null)
  const [aiSource, setAiSource] = React.useState<string | null>(null)
  const [isLoadingAI, setIsLoadingAI] = React.useState(false)
  const [syncSuccessResult, setSyncSuccessResult] = React.useState<{
    docUrl?: string
    syncedCount?: number
  } | null>(null)
  const [syncError, setSyncError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const unsyncedDoneTasks = tasks.filter((t) => t.status === "done" && !t.syncedToDocs)
  const allDoneTasks = tasks.filter((t) => t.status === "done")
  const tasksToSync = unsyncedDoneTasks.length > 0 ? unsyncedDoneTasks : allDoneTasks

  const handleGenerateAI = async () => {
    setIsLoadingAI(true)
    setSyncError(null)
    const mode = scope === "monthly" ? "monthly" : "weekly"
    const taskIds = tasksToSync.slice(0, 15).map((t) => t.id)

    const res = await fetchAISummary({
      taskIds: taskIds.length > 0 ? taskIds : undefined,
      mode,
    })

    setIsLoadingAI(false)
    if (res.executiveSummary) {
      setAiPreview(res.executiveSummary)
      setAiSource(res.source || "deterministic")
    } else if (res.error) {
      setSyncError(res.error)
    }
  }

  const handleExecuteSync = async () => {
    setSyncError(null)
    setSyncSuccessResult(null)

    const cadenceTypeMap: Record<string, "daily_table" | "weekly_summary" | "monthly_dossier" | "all"> = {
      daily_table: "daily_table",
      weekly: "weekly_summary",
      monthly: "monthly_dossier",
      all: "all",
    }

    const res = await syncDocs({
      taskIds: tasksToSync.map((t) => t.id),
      cadenceType: cadenceTypeMap[scope] || "daily_table",
      executiveSummary: scope !== "daily_table" ? (aiPreview || undefined) : undefined,
      includeContributions,
      force: scope === "daily_table",
    })

    if (res.success && res.result) {
      const data = res.result as { doc_url?: string; synced_tasks_count?: number }
      setSyncSuccessResult({
        docUrl: data.doc_url,
        syncedCount: data.synced_tasks_count,
      })
      await fetchTasks()
    } else {
      setSyncError(res.error || "Failed to sync to Google Docs.")
    }
  }

  const isRateLimited =
    scope === "daily_table"
      ? false
      : scope === "weekly"
      ? remainingManualSyncsWeek <= 0
      : scope === "monthly"
      ? remainingManualSyncsMonth <= 0
      : remainingManualSyncsWeek <= 0 || remainingManualSyncsMonth <= 0

  const getBudgetStyle = (remaining: number) => {
    if (remaining === 0) return { track: "bg-muted", fill: "bg-destructive", text: "text-destructive" }
    if (remaining === 1) return { track: "bg-muted", fill: "bg-warning", text: "text-warning" }
    return { track: "bg-muted", fill: "bg-primary", text: "text-foreground" }
  }

  const weekBudget = getBudgetStyle(remainingManualSyncsWeek)
  const monthBudget = getBudgetStyle(remainingManualSyncsMonth)

  return (
    <DialogContent className="bg-card text-card-foreground border border-border rounded-lg shadow-lg flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      {/* Header */}
      <div className="border-b border-border px-5 py-4 shrink-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Sync to Google Docs
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Format sprint deliverables and stream them into your Google Docs log.
          </DialogDescription>
        </DialogHeader>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* Rate-limit budget */}
        <div className="rounded-lg border border-border p-3.5 space-y-3 bg-card">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
            Rate-limit budget
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">This week</span>
                <span className={cn("font-medium", weekBudget.text)}>
                  {remainingManualSyncsWeek} of 2 manual syncs left
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", weekBudget.fill)}
                  style={{ width: `${(remainingManualSyncsWeek / 2) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">This month</span>
                <span className={cn("font-medium", monthBudget.text)}>
                  {remainingManualSyncsMonth} of 2 manual syncs left
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", monthBudget.fill)}
                  style={{ width: `${(remainingManualSyncsMonth / 2) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {isRateLimited && (
            <div className="bg-muted border border-border rounded-md p-2.5 flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Next automatic sync: {cadence.weekly_day || "Saturday"}, 00:00 UTC</span>
            </div>
          )}
        </div>

        {/* Connection & Target Doc State */}
        {!isConnected ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Google Docs is not connected</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Connect your Google account in Settings before syncing to Google Docs.
            </p>
            <Link href="/settings" onClick={onClose}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 mt-1">
                <span>Go to Settings to Connect</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        ) : !targetDocId ? (
          <div className="rounded-lg border border-primary/30 bg-primary-soft p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-primary font-medium">
              <FileText className="h-4 w-4 shrink-0" />
              <span>No target Google Doc configured</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Create an impact ledger document in your Google Drive with one click.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => createGoogleDoc()}
                disabled={isCreatingDoc}
                className="h-7 text-xs gap-1.5"
              >
                {isCreatingDoc ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FilePlus2 className="h-3 w-3" />
                    <span>Create Impact Doc</span>
                  </>
                )}
              </Button>
              <Link href="/settings" onClick={onClose}>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border p-3 text-xs bg-muted/20">
            <div className="space-y-0.5 truncate pr-2">
              <span className="text-muted-foreground text-xs block">Target Document</span>
              <span className="font-medium text-foreground truncate flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                {targetDocTitle || targetDocId}
              </span>
            </div>
            <a
              href={`https://docs.google.com/document/d/${targetDocId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 font-medium shrink-0"
            >
              <span>Open</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Cadence scope selector: segmented control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
              Sync Cadence Scope
            </span>
            {scope === "daily_table" && (
              <span className="text-[11px] font-medium text-success">
                ⚡ Unlimited syncs (No rate limits)
              </span>
            )}
          </div>
          <div className="bg-muted rounded-md p-1 grid grid-cols-2 sm:grid-cols-4 gap-1">
            {[
              { id: "daily_table", label: "Daily Table" },
              { id: "weekly", label: "Weekly Rollup" },
              { id: "monthly", label: "Monthly Appraisal" },
              { id: "all", label: "Full Sprint" },
            ].map((opt) => {
              const isSelected = scope === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id as "daily_table" | "all" | "weekly" | "monthly")}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-medium transition-all text-center select-none truncate px-1",
                    isSelected
                      ? "bg-card shadow-xs text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* AI summary preview (for AI scopes) or Table Info (for Daily Table) */}
        {scope === "daily_table" ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>Native 10-Column Google Docs Table</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Streams your completed tasks directly into an executive formatted table in Google Docs (Date, Project, Area, Contribution, Type, Priority, Requested By, Status, Outcome, Evidence). Does not consume AI quota or rate limits.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                AI summary preview
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAI}
                disabled={isLoadingAI}
                className="h-8 gap-1.5 text-xs"
              >
                <RefreshCw className={cn("h-3 w-3", isLoadingAI && "animate-spin")} />
                <span>{isLoadingAI ? "Generating..." : "Generate Preview"}</span>
              </Button>
            </div>

          {isLoadingAI ? (
            <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/40">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
            </div>
          ) : aiPreview ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border pb-1.5">
                <span className="text-xs font-medium text-foreground">Summary</span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    aiSource === "gemini"
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {aiSource === "gemini" ? "Gemini" : "Template"}
                </span>
              </div>
              <p className="text-foreground leading-relaxed whitespace-pre-line">
                {aiPreview}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <p className="text-muted-foreground text-xs">
                Click &quot;Generate Preview&quot; to synthesize {tasksToSync.length} task(s) before syncing.
              </p>
            </div>
          )}
        </div>
      )}

        {/* Include contributions toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3 text-xs bg-card">
          <span className="text-foreground font-medium">Include contribution notes &amp; PR links</span>
          <input
            type="checkbox"
            checked={includeContributions}
            onChange={(e) => setIncludeContributions(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
        </div>

        {/* Feedback banners */}
        {syncSuccessResult && (
          <div className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs bg-muted/30">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Synced to Google Docs</p>
              <p className="text-muted-foreground">
                Formatted {syncSuccessResult.syncedCount} task(s) in your document.
              </p>
              {syncSuccessResult.docUrl && (
                <a
                  href={syncSuccessResult.docUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <span>Open Document</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {syncError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 p-3 text-xs bg-destructive/5 text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{syncError}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-muted/20 shrink-0">
        <span className="text-muted-foreground text-xs">
          {tasksToSync.length} task(s) ready
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExecuteSync}
            disabled={isSyncing || isRateLimited || !isConnected || !targetDocId}
          >
            {isSyncing
              ? "Syncing..."
              : !isConnected
              ? "Connect Docs first"
              : !targetDocId
              ? "Create doc first"
              : "Sync now"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export function SmartSyncModal({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
}: SmartSyncModalProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (setControlledOpen || (() => {})) : setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync to Docs</span>
            </Button>
          }
        />
      )}
      {open && <SmartSyncModalContent onClose={() => setOpen(false)} />}
    </Dialog>
  )
}
