import { create } from "zustand"
import { authFetch } from "@/lib/api"
import { useTaskStore } from "./useTaskStore"

export type DailyTableCadence = "realtime" | "end_of_day" | "weekly"
export type WeeklyDay = "Friday" | "Saturday" | "Sunday"

export interface SyncCadence {
  daily_table_cadence: DailyTableCadence
  weekly_enabled: boolean
  weekly_day: WeeklyDay
  monthly_enabled: boolean
  manual_syncs_this_week: number
  manual_syncs_this_month: number
  max_manual_syncs_per_cycle: number
  last_weekly_sync_at?: string
  last_monthly_sync_at?: string
  timezone?: string
  // Set when a background (server-side) sync failed; cleared by the next successful sync
  table_sync_pending?: boolean
  last_sync_error?: string | null
  last_sync_error_at?: string | null
  last_sync_error_retryable?: boolean
}

export interface SummaryState {
  key: string
  generated: boolean
  // Tasks were added to or removed from the period since the summary was written
  stale: boolean
  summarized_task_count: number | null
  current_task_count: number
  generated_at: string | null
}

export interface SummaryStatus {
  week_num: number
  week_start: string
  week_end: string
  weekly: SummaryState
  monthly: SummaryState
}

export interface AutoSyncError {
  message: string
  // false when the user must act (e.g. reconnect Google) before a retry can succeed
  retryable: boolean
  failedAt: string
}

export type SyncResult = { success: boolean; result?: unknown; error?: string; status?: number }

export interface IntegrationState {
  isConnected: boolean
  targetDocId: string | null
  targetDocTitle: string | null
  updatedAt: string | null
  cadence: SyncCadence
  remainingManualSyncsWeek: number
  remainingManualSyncsMonth: number
  // AI previews left today on the server's Gemini key (null until loaded)
  aiPreviewsRemaining: number | null
  aiPreviewLimit: number
  isLoading: boolean
  isSyncing: boolean
  isCreatingDoc: boolean
  isExchangingCode: boolean
  error: string | null

  // Debounced Auto-Sync Worker state
  autoSyncCountdown: number | null
  hasPendingSync: boolean
  hasPendingDeletions: boolean
  lastSyncedAt: string | null
  inFlightDirty: boolean
  autoSyncError: AutoSyncError | null
  summaryStatus: SummaryStatus | null
  // Until the first status load succeeds, "not connected" is unknown rather than true
  statusLoaded: boolean
  statusLoadError: string | null

  fetchStatus: () => Promise<void>
  handleOAuthCallback: (code: string) => Promise<{ success: boolean; error?: string }>
  createGoogleDoc: (title?: string) => Promise<{ success: boolean; docUrl?: string; docId?: string; error?: string }>
  setTargetDoc: (docId: string) => Promise<boolean>
  updateCadence: (updates: {
    daily_table_cadence?: DailyTableCadence
    weekly_enabled?: boolean
    weekly_day?: WeeklyDay
    monthly_enabled?: boolean
    timezone?: string
  }) => Promise<boolean>
  disconnect: () => Promise<boolean>
  syncDailyTable: (taskIds?: string[]) => Promise<SyncResult>
  syncDocs: (options?: {
    taskIds?: string[]
    cadenceType?: "all" | "weekly" | "monthly" | "daily_table" | "weekly_summary" | "monthly_dossier"
    // Previewed texts (and the fingerprints from their preview responses) to sync as is
    executiveSummary?: string
    weeklyFingerprint?: string
    monthlyDossier?: string
    monthlyFingerprint?: string
    includeContributions?: boolean
  }) => Promise<SyncResult>
  fetchAISummary: (options?: {
    taskIds?: string[]
    mode?: "weekly" | "monthly" | "weekly_rollup" | "monthly_appraisal" | "executive"
    customContext?: string
  }) => Promise<{
    executiveSummary?: string
    source?: string
    taskCount?: number
    fingerprint?: string
    error?: string
  }>
  fetchPreviewQuota: () => Promise<void>
  fetchSummaryStatus: () => Promise<void>
  notifyChange: (options?: { isDeletion?: boolean }) => void
  cancelAutoSyncIfClean: () => void
  // Resolves true when the daily table synced
  flushAutoSync: () => Promise<boolean>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

// Failed background syncs retry after 30s, 1m, 2m, 4m, then every 5m
let autoSyncRetryTimer: ReturnType<typeof setTimeout> | null = null
let autoSyncFailures = 0
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 5 * 60_000

function clearAutoSyncTimers() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  if (autoSyncRetryTimer) {
    clearTimeout(autoSyncRetryTimer)
    autoSyncRetryTimer = null
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

// IANA zone of this browser (e.g. "Asia/Kolkata"); the backend schedules syncs in it
function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

const defaultCadence: SyncCadence = {
  daily_table_cadence: "realtime",
  weekly_enabled: true,
  weekly_day: "Saturday",
  monthly_enabled: true,
  manual_syncs_this_week: 0,
  manual_syncs_this_month: 0,
  max_manual_syncs_per_cycle: 2,
}

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  isConnected: false,
  targetDocId: null,
  targetDocTitle: null,
  updatedAt: null,
  cadence: defaultCadence,
  remainingManualSyncsWeek: 2,
  remainingManualSyncsMonth: 2,
  aiPreviewsRemaining: null,
  aiPreviewLimit: 5,
  isLoading: false,
  isSyncing: false,
  isCreatingDoc: false,
  isExchangingCode: false,
  error: null,

  autoSyncCountdown: null,
  hasPendingSync: false,
  hasPendingDeletions: false,
  lastSyncedAt: null,
  inFlightDirty: false,
  autoSyncError: null,
  summaryStatus: null,
  statusLoaded: false,
  statusLoadError: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/status`, {
        headers: {
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        throw new Error("Failed to load Google Docs integration status")
      }
      const data = await res.json()
      set({
        isConnected: Boolean(data.connected),
        targetDocId: data.target_doc_id || null,
        targetDocTitle: data.target_doc_title || null,
        updatedAt: data.updated_at || null,
        cadence: data.cadence || defaultCadence,
        remainingManualSyncsWeek: data.remaining_manual_syncs_week ?? 2,
        remainingManualSyncsMonth: data.remaining_manual_syncs_month ?? 2,
        isLoading: false,
        error: null,
        statusLoaded: true,
        statusLoadError: null,
      })

      // Keep the stored zone in step with the browser (covers users connected before
      // time zones existed, and travel) so scheduled syncs run at local times
      const timezone = browserTimeZone()
      if (data.connected && timezone && data.cadence?.timezone !== timezone) {
        void get().updateCadence({ timezone })
      }
    } catch {
      // Keep the last known state: a failed load must not look like "not connected"
      set({ isLoading: false, statusLoadError: "Couldn't load Google Docs status" })
    }
  },

  handleOAuthCallback: async (code: string) => {
    set({ isExchangingCode: true, error: null })
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, timezone: browserTimeZone() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to exchange Google OAuth code")
      }
      const data = await res.json()
      set({
        isConnected: Boolean(data.connected),
        targetDocId: data.target_doc_id || null,
        targetDocTitle: data.target_doc_title || null,
        updatedAt: data.updated_at || null,
        cadence: data.cadence || get().cadence,
        remainingManualSyncsWeek: data.remaining_manual_syncs_week ?? 2,
        remainingManualSyncsMonth: data.remaining_manual_syncs_month ?? 2,
        isExchangingCode: false,
        error: null,
      })
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OAuth authorization failed"
      set({ isExchangingCode: false, error: msg })
      return { success: false, error: msg }
    }
  },

  createGoogleDoc: async (title?: string) => {
    set({ isCreatingDoc: true, error: null })
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/create-doc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: title || "Tethr — Developer Contribution Ledger" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to create Google Doc")
      }
      const data = await res.json()
      set({
        targetDocId: data.doc_id,
        targetDocTitle: data.title,
        isCreatingDoc: false,
      })
      return { success: true, docUrl: data.doc_url, docId: data.doc_id }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create Google Doc"
      set({ isCreatingDoc: false, error: msg })
      return { success: false, error: msg }
    }
  },

  setTargetDoc: async (docId: string) => {
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/target-doc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_doc_id: docId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to update target doc")
      }
      const data = await res.json()
      set({
        isConnected: Boolean(data.connected),
        targetDocId: data.target_doc_id,
        targetDocTitle: data.target_doc_title,
        cadence: data.cadence || get().cadence,
        remainingManualSyncsWeek: data.remaining_manual_syncs_week ?? get().remainingManualSyncsWeek,
        remainingManualSyncsMonth: data.remaining_manual_syncs_month ?? get().remainingManualSyncsMonth,
      })
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update target doc"
      set({ error: msg })
      return false
    }
  },

  updateCadence: async (updates) => {
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/cadence`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to update sync cadence")
      }
      const data = await res.json()
      set({
        cadence: data.cadence || get().cadence,
        remainingManualSyncsWeek: data.remaining_manual_syncs_week ?? get().remainingManualSyncsWeek,
        remainingManualSyncsMonth: data.remaining_manual_syncs_month ?? get().remainingManualSyncsMonth,
      })
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update cadence"
      set({ error: msg })
      return false
    }
  },

  disconnect: async () => {
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/disconnect`, {
        method: "DELETE",
      })
      if (res.ok || res.status === 204) {
        set({
          isConnected: false,
          targetDocId: null,
          targetDocTitle: null,
          remainingManualSyncsWeek: 2,
          remainingManualSyncsMonth: 2,
        })
        return true
      }
      return false
    } catch {
      return false
    }
  },

  syncDailyTable: async (taskIds?: string[]) => {
    return get().syncDocs({
      taskIds,
      cadenceType: "daily_table",
      includeContributions: true,
    })
  },

  syncDocs: async (options = {}) => {
    set({ isSyncing: true, error: null })
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_ids: options.taskIds,
          cadence_type: options.cadenceType || "all",
          executive_summary: options.executiveSummary,
          weekly_fingerprint: options.weeklyFingerprint,
          monthly_dossier: options.monthlyDossier,
          monthly_fingerprint: options.monthlyFingerprint,
          include_contributions: options.includeContributions ?? true,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err.detail || "Sync to Google Docs failed"
        set({ isSyncing: false, error: msg })
        return { success: false, error: msg, status: res.status }
      }

      const result = await res.json()
      // Refresh status, remaining count, and tasks
      await get().fetchStatus()
      try {
        await useTaskStore.getState().fetchTasks()
      } catch {
        // Non-critical if task refresh fails
      }
      set({ isSyncing: false })
      return { success: true, result }
    } catch {
      // fetch() itself failed: offline, DNS, or the server is unreachable (no HTTP status)
      const msg = "Couldn't reach the server"
      set({ isSyncing: false, error: msg })
      return { success: false, error: msg }
    }
  },

  fetchAISummary: async (options = {}) => {
    try {
      const normalizedMode =
        options.mode === "monthly" || options.mode === "monthly_appraisal"
          ? "monthly"
          : "weekly"

      const res = await authFetch(`${API_BASE}/ai/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_ids: options.taskIds,
          mode: normalizedMode,
          custom_context: options.customContext,
        }),
      })

      if (!res.ok) {
        if (res.status === 429) set({ aiPreviewsRemaining: 0 })
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to generate AI summary")
      }

      const data = await res.json()
      if (typeof data.remaining_previews === "number") {
        set({ aiPreviewsRemaining: data.remaining_previews })
      }
      return {
        executiveSummary: data.executive_summary,
        source: data.source,
        taskCount: data.task_count,
        fingerprint: data.fingerprint,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI synthesis failed"
      return { error: msg }
    }
  },

  fetchPreviewQuota: async () => {
    try {
      const res = await authFetch(`${API_BASE}/ai/preview-quota`)
      if (!res.ok) return
      const data = await res.json()
      set({ aiPreviewsRemaining: data.remaining, aiPreviewLimit: data.limit })
    } catch {
      // Non-critical: the server still enforces the limit
    }
  },

  fetchSummaryStatus: async () => {
    try {
      const res = await authFetch(`${API_BASE}/integrations/google/summary-status`)
      if (!res.ok) return
      set({ summaryStatus: await res.json() })
    } catch {
      // Non-critical: only drives the "summary out of date" notice
    }
  },

  notifyChange: (options) => {
    const { isConnected, targetDocId, isSyncing, cadence } = get()
    if (!isConnected || !targetDocId) return
    // Only the "realtime" cadence syncs on every change; end_of_day / weekly are
    // handled by the backend scheduler (the manual "Sync" button still works)
    if (cadence.daily_table_cadence !== "realtime") return

    set({
      hasPendingSync: true,
      hasPendingDeletions: options?.isDeletion ? true : get().hasPendingDeletions,
    })

    // If a sync is currently in flight, record dirty flag so it queues a follow-up batch
    if (isSyncing) {
      set({ inFlightDirty: true })
      return
    }

    // If countdown timer is already ticking down, let it run
    if (autoSyncTimer !== null) {
      return
    }

    // Start 30-second debounced countdown
    set({ autoSyncCountdown: 30 })
    autoSyncTimer = setInterval(() => {
      const current = get().autoSyncCountdown
      if (current === null || current <= 1) {
        if (autoSyncTimer) {
          clearInterval(autoSyncTimer)
          autoSyncTimer = null
        }
        set({ autoSyncCountdown: null })
        get().flushAutoSync()
      } else {
        set({ autoSyncCountdown: current - 1 })
      }
    }, 1000)
  },

  cancelAutoSyncIfClean: () => {
    // Check if there are any remaining unsynced tasks or pending deletions
    const hasUnsynced = useTaskStore.getState().tasks.some((t) => !t.syncedToDocs)
    const { hasPendingDeletions } = get()
    if (!hasUnsynced && !hasPendingDeletions) {
      if (autoSyncTimer) {
        clearInterval(autoSyncTimer)
        autoSyncTimer = null
      }
      set({ autoSyncCountdown: null, hasPendingSync: false })
    }
  },

  flushAutoSync: async () => {
    clearAutoSyncTimers()
    set({ autoSyncCountdown: null })

    if (get().isSyncing) {
      set({ inFlightDirty: true })
      return false
    }

    if (isOffline()) {
      // The "online" listener below flushes as soon as the connection is back
      set({
        hasPendingSync: true,
        autoSyncError: {
          message: "You're offline. Changes will sync to Google Docs when you reconnect.",
          retryable: true,
          failedAt: new Date().toISOString(),
        },
      })
      return false
    }

    const res = await get().syncDailyTable()

    if (!res.success) {
      // No status = network failure; 5xx/429 are temporary. Other 4xx (e.g. expired Google
      // access, no target doc) need the user to act, so retrying would only fail again.
      const retryable = res.status === undefined || res.status >= 500 || res.status === 429
      autoSyncFailures += 1
      set({
        hasPendingSync: true,
        inFlightDirty: false,
        autoSyncError: {
          message: res.error || "Sync to Google Docs failed",
          retryable,
          failedAt: new Date().toISOString(),
        },
      })
      if (retryable) {
        const delay = Math.min(RETRY_BASE_MS * 2 ** (autoSyncFailures - 1), RETRY_MAX_MS)
        autoSyncRetryTimer = setTimeout(() => {
          autoSyncRetryTimer = null
          get().flushAutoSync()
        }, delay)
      }
      return false
    }

    autoSyncFailures = 0
    set({ autoSyncError: null, hasPendingDeletions: false })

    // If another mutation happened while sync was in-flight, re-arm the timer
    if (get().inFlightDirty) {
      set({ inFlightDirty: false })
      get().notifyChange()
    } else {
      set({
        hasPendingSync: false,
        lastSyncedAt: new Date().toISOString(),
      })
    }
    return true
  },
}))

// Retry a pending or failed sync as soon as the browser is back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    const { isConnected, targetDocId, hasPendingSync, autoSyncError, flushAutoSync } =
      useIntegrationStore.getState()
    if (isConnected && targetDocId && (hasPendingSync || autoSyncError?.retryable)) {
      flushAutoSync()
    }
  })
}
