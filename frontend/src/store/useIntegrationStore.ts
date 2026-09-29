import { create } from "zustand"
import { getAuthHeader, useTaskStore } from "./useTaskStore"

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
}

export interface IntegrationState {
  isConnected: boolean
  targetDocId: string | null
  targetDocTitle: string | null
  updatedAt: string | null
  cadence: SyncCadence
  remainingManualSyncsWeek: number
  remainingManualSyncsMonth: number
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

  fetchStatus: () => Promise<void>
  handleOAuthCallback: (code: string) => Promise<{ success: boolean; error?: string }>
  createGoogleDoc: (title?: string) => Promise<{ success: boolean; docUrl?: string; docId?: string; error?: string }>
  setTargetDoc: (docId: string) => Promise<boolean>
  updateCadence: (updates: {
    daily_table_cadence?: DailyTableCadence
    weekly_enabled?: boolean
    weekly_day?: WeeklyDay
    monthly_enabled?: boolean
  }) => Promise<boolean>
  disconnect: () => Promise<boolean>
  syncDailyTable: (taskIds?: string[]) => Promise<{ success: boolean; result?: unknown; error?: string }>
  syncDocs: (options?: {
    taskIds?: string[]
    cadenceType?: "all" | "weekly" | "monthly" | "daily_table" | "weekly_summary" | "monthly_dossier"
    executiveSummary?: string
    includeContributions?: boolean
    force?: boolean
  }) => Promise<{ success: boolean; result?: unknown; error?: string }>
  fetchAISummary: (options?: {
    taskIds?: string[]
    mode?: "weekly" | "monthly" | "weekly_rollup" | "monthly_appraisal" | "executive"
    customContext?: string
  }) => Promise<{ executiveSummary?: string; source?: string; taskCount?: number; error?: string }>
  notifyChange: (options?: { isDeletion?: boolean }) => void
  cancelAutoSyncIfClean: () => void
  flushAutoSync: () => Promise<void>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1"

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

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

  fetchStatus: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/integrations/google/status`, {
        headers: {
          ...getAuthHeader(),
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
      })
    } catch {
      set({ isLoading: false })
    }
  },

  handleOAuthCallback: async (code: string) => {
    set({ isExchangingCode: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/integrations/google/callback`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
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
      const res = await fetch(`${API_BASE}/integrations/google/create-doc`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
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
      const res = await fetch(`${API_BASE}/integrations/google/target-doc`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
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
      const res = await fetch(`${API_BASE}/integrations/google/cadence`, {
        method: "PATCH",
        headers: {
          ...getAuthHeader(),
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
      const res = await fetch(`${API_BASE}/integrations/google/disconnect`, {
        method: "DELETE",
        headers: getAuthHeader(),
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
      force: true,
    })
  },

  syncDocs: async (options = {}) => {
    set({ isSyncing: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/integrations/google/sync`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_ids: options.taskIds,
          cadence_type: options.cadenceType || "all",
          executive_summary: options.executiveSummary,
          include_contributions: options.includeContributions ?? true,
          force: options.force ?? false,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Sync to Google Docs failed")
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync error"
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

      const res = await fetch(`${API_BASE}/ai/summarize`, {
        method: "POST",
        headers: {
          ...getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_ids: options.taskIds,
          mode: normalizedMode,
          custom_context: options.customContext,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to generate AI summary")
      }

      const data = await res.json()
      return {
        executiveSummary: data.executive_summary,
        source: data.source,
        taskCount: data.task_count,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI synthesis failed"
      return { error: msg }
    }
  },

  notifyChange: (options) => {
    const { isConnected, targetDocId, isSyncing } = get()
    if (!isConnected || !targetDocId) return

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
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer)
      autoSyncTimer = null
    }
    set({ autoSyncCountdown: null })

    if (get().isSyncing) {
      set({ inFlightDirty: true })
      return
    }

    await get().syncDailyTable()
    set({ hasPendingDeletions: false })

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
  },
}))
