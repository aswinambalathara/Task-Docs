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

type Scope = "daily_table" | "weekly" | "monthly" | "all"
type SummaryKind = "weekly" | "monthly"

interface SummaryPreview {
  text: string
  source: string
  // Identifies the tasks the text was written about; sent with the sync so the backend
  // can tell when later task changes make the synced summary out of date
  fingerprint?: string
  taskCount?: number
}

// Which AI summaries each scope writes to the document
const SCOPE_KINDS: Record<Scope, SummaryKind[]> = {
  daily_table: [],
  weekly: ["weekly"],
  monthly: ["monthly"],
  all: ["weekly", "monthly"],
}

const SCOPE_OPTIONS: { id: Scope; label: string }[] = [
  { id: "daily_table", label: "Daily Table" },
  { id: "weekly", label: "Weekly Rollup" },
  { id: "monthly", label: "Monthly Appraisal" },
  { id: "all", label: "Weekly + Monthly" },
]

const CADENCE_TYPES: Record<Scope, "daily_table" | "weekly_summary" | "monthly_dossier" | "all"> = {
  daily_table: "daily_table",
  weekly: "weekly_summary",
  monthly: "monthly_dossier",
  all: "all",
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
    aiPreviewsRemaining,
    aiPreviewLimit,
    fetchPreviewQuota,
    summaryStatus,
    fetchSummaryStatus,
  } = useIntegrationStore()

  const { tasks, fetchTasks } = useTaskStore()

  const [scope, setScope] = React.useState<Scope>("daily_table")
  const [includeContributions, setIncludeContributions] = React.useState(true)
  const [previews, setPreviews] = React.useState<Partial<Record<SummaryKind, SummaryPreview>>>({})
  const [previewTab, setPreviewTab] = React.useState<SummaryKind>("weekly")
  const [loadingKind, setLoadingKind] = React.useState<SummaryKind | null>(null)
  const [syncSuccessResult, setSyncSuccessResult] = React.useState<{
    docUrl?: string
    syncedCount?: number
  } | null>(null)
  const [syncError, setSyncError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchStatus()
    fetchPreviewQuota()
    fetchSummaryStatus()
  }, [fetchStatus, fetchPreviewQuota, fetchSummaryStatus])

  const previewsExhausted = aiPreviewsRemaining === 0

  const unsyncedDoneTasks = tasks.filter((t) => t.status === "done" && !t.syncedToDocs)
  const allDoneTasks = tasks.filter((t) => t.status === "done")
  const tasksToSync = unsyncedDoneTasks.length > 0 ? unsyncedDoneTasks : allDoneTasks

  const scopeKinds = SCOPE_KINDS[scope]
  const activeKind: SummaryKind | null =
    scopeKinds.length === 0 ? null : scopeKinds.includes(previewTab) ? previewTab : scopeKinds[0]
  const activePreview = activeKind ? previews[activeKind] : undefined
  const weekLabel = summaryStatus ? `Week ${summaryStatus.week_num}` : "current week"
  const kindLabel = (kind: SummaryKind) =>
    kind === "weekly" ? `${weekLabel} summary` : "This month's dossier"

  const handleGenerateAI = async () => {
    if (!activeKind) return
    const kind = activeKind
    setLoadingKind(kind)
    setSyncError(null)

    // No task IDs: the backend previews exactly the tasks the synced summary will cover
    const res = await fetchAISummary({ mode: kind })

    setLoadingKind(null)
    if (res.executiveSummary) {
      setPreviews((prev) => ({
        ...prev,
        [kind]: {
          text: res.executiveSummary as string,
          source: res.source || "deterministic",
          fingerprint: res.fingerprint,
          taskCount: res.taskCount,
        },
      }))
    } else if (res.error) {
      setSyncError(res.error)
    }
  }

  const handleExecuteSync = async () => {
    setSyncError(null)
    setSyncSuccessResult(null)

    // Each previewed text goes to its own summary; without a preview the backend generates it
    const weekly = scopeKinds.includes("weekly") ? previews.weekly : undefined
    const monthly = scopeKinds.includes("monthly") ? previews.monthly : undefined

    const res = await syncDocs({
      cadenceType: CADENCE_TYPES[scope],
      executiveSummary: weekly?.text,
      weeklyFingerprint: weekly?.fingerprint,
      monthlyDossier: monthly?.text,
      monthlyFingerprint: monthly?.fingerprint,
      includeContributions,
    })

    if (res.success && res.result) {
      const data = res.result as { doc_url?: string; synced_tasks_count?: number }
      setSyncSuccessResult({
        docUrl: data.doc_url,
        syncedCount: data.synced_tasks_count,
      })
      await Promise.all([fetchTasks(), fetchSummaryStatus()])
    } else {
      setSyncError(res.error || "Failed to sync to Google Docs.")
    }
  }

  const weeklyLimited = scopeKinds.includes("weekly") && remainingManualSyncsWeek <= 0
  const monthlyLimited = scopeKinds.includes("monthly") && remainingManualSyncsMonth <= 0
  const isRateLimited = weeklyLimited || monthlyLimited
  const maxSyncs = cadence.max_manual_syncs_per_cycle || 2

  const scopeHint: Record<Scope, string> = {
    daily_table: "Rebuilds the daily contribution table. No AI and no sync limits.",
    weekly: `Writes the ${weekLabel} summary. Uses 1 of your ${maxSyncs} weekly summary syncs.`,
    monthly: `Writes this month's appraisal dossier. Uses 1 of your ${maxSyncs} monthly syncs.`,
    all: `Writes the ${weekLabel} summary and this month's dossier. Uses 1 weekly and 1 monthly sync.`,
  }

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
            <div className="bg-muted border border-border rounded-md p-2.5 flex items-start gap-2 text-xs text-muted-foreground mt-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="space-y-0.5">
                {weeklyLimited && (
                  <p>
                    Weekly summary limit reached.
                    {cadence.weekly_enabled &&
                      ` The next one is written automatically on ${cadence.weekly_day} at 18:00 (${cadence.timezone || "UTC"}).`}
                  </p>
                )}
                {monthlyLimited && (
                  <p>
                    Monthly dossier limit reached.
                    {cadence.monthly_enabled &&
                      ` The next one is written automatically on the last day of the month at 18:00 (${cadence.timezone || "UTC"}).`}
                  </p>
                )}
              </div>
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
            {SCOPE_OPTIONS.map((opt) => {
              const isSelected = scope === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
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
          <p className="text-muted-foreground text-xs">{scopeHint[scope]}</p>
        </div>

        {/* Whether the summaries this scope rewrites are still current */}
        {summaryStatus &&
          scopeKinds.map((kind) => {
            const state = summaryStatus[kind]
            if (!state.generated) return null
            if (state.stale) {
              return (
                <div
                  key={kind}
                  className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                  <p className="text-foreground leading-relaxed">
                    <span className="font-medium">{kindLabel(kind)} is out of date.</span>{" "}
                    {state.summarized_task_count !== null
                      ? `It was written about ${state.summarized_task_count} task(s); ${state.current_task_count} are logged now.`
                      : `Tasks were added or removed since it was written (${state.current_task_count} logged now).`}{" "}
                    It is rewritten automatically tonight, or sync now to replace it.
                  </p>
                </div>
              )
            }
            return (
              <div key={kind} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                <span>
                  {kindLabel(kind)} is up to date ({state.current_task_count} task
                  {state.current_task_count === 1 ? "" : "s"}). Syncing again replaces it.
                </span>
              </div>
            )
          })}

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  AI preview
                </span>
                {scopeKinds.length > 1 && (
                  <div className="bg-muted rounded-md p-0.5 flex gap-0.5">
                    {scopeKinds.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setPreviewTab(kind)}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium transition-all inline-flex items-center gap-1",
                          activeKind === kind
                            ? "bg-card shadow-xs text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {kind === "weekly" ? "Weekly" : "Monthly"}
                        {previews[kind] && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aiPreviewsRemaining !== null && (
                  <span
                    className={cn(
                      "text-xs",
                      previewsExhausted ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {aiPreviewsRemaining} of {aiPreviewLimit} previews left today
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAI}
                  disabled={loadingKind !== null || previewsExhausted}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={cn("h-3 w-3", loadingKind !== null && "animate-spin")} />
                  <span>
                    {loadingKind !== null
                      ? "Generating..."
                      : activePreview
                      ? "Regenerate"
                      : "Generate Preview"}
                  </span>
                </Button>
              </div>
            </div>

            {loadingKind !== null && loadingKind === activeKind ? (
              <div className="space-y-2 rounded-lg border border-border p-3.5 bg-muted/40">
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
              </div>
            ) : activeKind && activePreview ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    {kindLabel(activeKind)}
                    {activePreview.taskCount !== undefined &&
                      ` · ${activePreview.taskCount} task${activePreview.taskCount === 1 ? "" : "s"}`}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      activePreview.source.startsWith("gemini")
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {activePreview.source.startsWith("gemini") ? "Gemini" : "Template"}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed whitespace-pre-line">
                  {activePreview.text}
                </p>
              </div>
            ) : activeKind ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-1">
                <p className="text-muted-foreground text-xs">
                  Click &quot;Generate Preview&quot; to draft{" "}
                  {activeKind === "weekly" ? `the ${weekLabel} summary` : "this month's dossier"}
                  {summaryStatus &&
                    ` from ${summaryStatus[activeKind].current_task_count} task(s)`}
                  .
                </p>
                <p className="text-muted-foreground text-xs">
                  Optional: if you sync without a preview, it is generated during the sync.
                </p>
              </div>
            ) : null}
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
