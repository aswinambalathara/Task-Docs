"use client"

import * as React from "react"
import {
  FileText,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  CheckCircle2,
  Lock,
  Sun,
  Moon,
  Monitor,
  Unlink,
  FilePlus2,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useIntegrationStore, DailyTableCadence, WeeklyDay } from "@/store/useIntegrationStore"
import { getAuthHeader } from "@/store/useTaskStore"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { isLoaded, isSignedIn } = useUser()
  const { theme, setTheme } = useTheme()
  const {
    isConnected,
    targetDocId,
    targetDocTitle,
    cadence,
    remainingManualSyncsWeek,
    isCreatingDoc,
    isExchangingCode,
    fetchStatus,
    setTargetDoc,
    createGoogleDoc,
    handleOAuthCallback,
    updateCadence,
    disconnect,
    syncDocs,
  } = useIntegrationStore()

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const [docIdInput, setDocIdInput] = React.useState<string | null>(null)
  const activeDocId = docIdInput !== null ? docIdInput : (targetDocId || "")
  const [isSavingDoc, setIsSavingDoc] = React.useState(false)
  const [docSavedMessage, setDocSavedMessage] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [testSuccess, setTestSuccess] = React.useState(false)
  const [copiedConfig, setCopiedConfig] = React.useState(false)
  const [copiedSseUrl, setCopiedSseUrl] = React.useState(false)
  const [oauthNotice, setOauthNotice] = React.useState<{
    type: "success" | "error" | "loading"
    message: string
  } | null>(null)

  React.useEffect(() => {
    if (!isSignedIn) return
    fetchStatus()

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const error = params.get("error")

      if (error) {
        setOauthNotice({
          type: "error",
          message: `Google authorization cancelled or denied (${error}).`,
        })
        window.history.replaceState({}, document.title, window.location.pathname)
      } else if (code) {
        setOauthNotice({
          type: "loading",
          message: "Exchanging Google authorization code & saving encrypted credentials...",
        })
        handleOAuthCallback(code).then((res) => {
          if (res.success) {
            setOauthNotice({
              type: "success",
              message: "Google Docs successfully connected!",
            })
            setTimeout(() => setOauthNotice(null), 5000)
          } else {
            setOauthNotice({
              type: "error",
              message: res.error || "Failed to exchange Google OAuth code.",
            })
          }
          window.history.replaceState({}, document.title, window.location.pathname)
        })
      }
    }
  }, [fetchStatus, handleOAuthCallback, isSignedIn])

  const handleSaveDocId = async () => {
    if (!activeDocId.trim()) return
    setIsSavingDoc(true)
    const success = await setTargetDoc(activeDocId.trim())
    setIsSavingDoc(false)
    if (success) {
      setDocSavedMessage(true)
      setTimeout(() => setDocSavedMessage(false), 2500)
    }
  }

  const handleCreateDoc = async () => {
    const res = await createGoogleDoc()
    if (res.success && res.docId) {
      setDocIdInput(res.docId)
      setDocSavedMessage(true)
      setTimeout(() => setDocSavedMessage(false), 3000)
    }
  }

  const handleGoogleConnect = async () => {
    try {
      const res = await fetch("/api/v1/integrations/google/auth-url", {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.auth_url) {
          window.location.href = data.auth_url
        }
      }
    } catch {
      // Offline fallback
    }
  }

  const handleTestSync = async () => {
    setIsTesting(true)
    setTestSuccess(false)
    const res = await syncDocs({ force: true })
    setIsTesting(false)
    if (res.success) {
      setTestSuccess(true)
      setTimeout(() => setTestSuccess(false), 3000)
    }
  }

  const copyToClipboard = (text: string, type: "config" | "sse") => {
    navigator.clipboard.writeText(text)
    if (type === "config") {
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
    } else {
      setCopiedSseUrl(true)
      setTimeout(() => setCopiedSseUrl(false), 2000)
    }
  }

  const [activeMcpClient, setActiveMcpClient] = React.useState<"cursor" | "claude" | "windsurf" | "antigravity">("cursor")

  const getMcpConfigFilePath = (client: "cursor" | "claude" | "windsurf" | "antigravity") => {
    switch (client) {
      case "cursor":
        return "~/.cursor/mcp.json or .cursor/mcp.json"
      case "claude":
        return "%APPDATA%/Claude/claude_desktop_config.json"
      case "windsurf":
        return "~/.codeium/windsurf/mcp_config.json"
      case "antigravity":
        return "~/.gemini/config/mcp_config.json"
    }
  }

  const getCurrentMcpSnippet = () => {
    switch (activeMcpClient) {
      case "cursor":
        return `{
  "mcpServers": {
    "tethr": {
      "url": "http://localhost:8000/sse"
    }
  }
}`
      case "claude":
        return `{
  "mcpServers": {
    "tethr": {
      "url": "http://localhost:8000/sse"
    }
  }
}`
      case "windsurf":
        return `{
  "mcpServers": {
    "tethr": {
      "serverUrl": "http://localhost:8000/sse"
    }
  }
}`
      case "antigravity":
        return `{
  "mcpServers": {
    "tethr": {
      "url": "http://localhost:8000/sse"
    }
  }
}`
    }
  }

  if (!mounted || !isLoaded) {
    return (
      <div className="container mx-auto flex max-w-5xl items-center justify-center px-4 py-16">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Sign In Required</h2>
            <p className="text-muted-foreground text-xs">
              Please authenticate to configure Google Docs integration & MCP credentials.
            </p>
          </div>
          <Link href="/sign-in" className="block w-full">
            <Button className="w-full">Sign In</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="space-y-1 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl text-foreground">
          Settings &amp; Integrations
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage Google Docs synchronization, cadences, theme appearance, and MCP protocol connections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Theme Configuration */}
          <Card className="p-5 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-foreground">Theme Appearance</h2>
              <p className="text-muted-foreground text-xs">Select your preferred color mode for Tethr.</p>
            </div>

            <div className="bg-muted rounded-md p-1 grid grid-cols-3 gap-1">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Monitor },
              ].map((item) => {
                const isSelected = theme === item.id
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium transition-all select-none",
                      isSelected
                        ? "bg-card shadow-xs text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* OAuth Status Notification Banner */}
          {oauthNotice && (
            <div
              className={cn(
                "rounded-lg border p-4 text-xs font-medium flex items-center gap-3 transition-all",
                oauthNotice.type === "success" &&
                  "bg-success/10 border-success/30 text-success",
                oauthNotice.type === "error" &&
                  "bg-destructive/10 border-destructive/30 text-destructive",
                oauthNotice.type === "loading" &&
                  "bg-primary-soft border-primary/20 text-foreground"
              )}
            >
              {oauthNotice.type === "loading" && (
                <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
              )}
              {oauthNotice.type === "success" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              )}
              {oauthNotice.type === "error" && (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="flex-1">{oauthNotice.message}</div>
              {oauthNotice.type !== "loading" && (
                <button
                  type="button"
                  onClick={() => setOauthNotice(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {/* 2. Google Docs Integration Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Google Docs Synchronization</h2>
                  <p className="text-muted-foreground text-xs">
                    Automated updates streamed into your impact ledger document
                  </p>
                </div>
              </div>

              {isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
                    title="Disconnect Google Docs"
                    aria-label="Disconnect Google Docs"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Not connected
                  </span>
                  <Button
                    size="sm"
                    onClick={handleGoogleConnect}
                    disabled={isExchangingCode}
                    className="gap-1.5"
                  >
                    {isExchangingCode ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Connect Google Docs</span>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Document Configuration Section */}
            {isConnected ? (
              <div className="space-y-3 pt-2">
                {targetDocId ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs text-muted-foreground">Active Impact Ledger Document</span>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-primary" />
                          {targetDocTitle || "Tethr — Developer Contribution Ledger"}
                        </h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const cleanId = activeDocId.includes("/")
                            ? activeDocId.split("/d/")[1]?.split("/")[0]
                            : activeDocId
                          window.open(`https://docs.google.com/document/d/${cleanId}/edit`, "_blank")
                        }}
                        className="gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Document</span>
                      </Button>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      ID: {targetDocId}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/20 bg-primary-soft p-4 space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        No Target Document Configured
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Create a dedicated Google Doc with pre-formatted headers, or link an existing doc.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCreateDoc}
                      disabled={isCreatingDoc}
                      className="gap-1.5"
                    >
                      {isCreatingDoc ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Creating in Google Drive...</span>
                        </>
                      ) : (
                        <>
                          <FilePlus2 className="h-3.5 w-3.5" />
                          <span>Create Impact Ledger Document</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Target Google Document ID or Link */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="doc-id" className="text-xs font-medium text-foreground">
                      {targetDocId ? "Change Document ID or URL" : "Or Paste Google Document ID / URL"}
                    </Label>
                    {!targetDocId && (
                      <button
                        type="button"
                        onClick={handleCreateDoc}
                        disabled={isCreatingDoc}
                        className="text-primary text-xs font-medium hover:underline inline-flex items-center gap-1"
                      >
                        <FilePlus2 className="h-3 w-3" />
                        {isCreatingDoc ? "Creating..." : "Create new doc instead"}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="doc-id"
                      value={activeDocId}
                      onChange={(e) => setDocIdInput(e.target.value)}
                      placeholder="e.g. 1BxiMvs0XRY5n5DCa_example or full docs URL"
                      className="font-mono text-xs flex-1"
                    />
                    <Button
                      onClick={handleSaveDocId}
                      disabled={isSavingDoc || !activeDocId.trim()}
                      size="sm"
                    >
                      {isSavingDoc ? "Saving..." : "Save ID"}
                    </Button>
                  </div>
                  {docSavedMessage && (
                    <p className="text-success text-xs font-medium flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Document ID saved!
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Connect your Google account to enable automated Google Docs synchronization. Your access tokens are refreshed automatically and encrypted with AES-256.
                </p>
                <Button size="sm" onClick={handleGoogleConnect} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Connect Google Docs</span>
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestSync}
                  disabled={isTesting || !activeDocId}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isTesting && "animate-spin")} />
                  <span>{isTesting ? "Testing..." : "Test Docs Sync"}</span>
                </Button>
                {testSuccess && (
                  <span className="flex items-center gap-1 text-xs text-success font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Verified write
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">
                Budget: {remainingManualSyncsWeek}/2 manual syncs left this week
              </span>
            </div>
          </Card>

          {/* 3. Automated Sync Cadence Configuration */}
          <Card className="p-5 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-foreground">Sync Cadence</h2>
              <p className="text-muted-foreground text-xs">
                Configure frequency for daily table batching and weekly rollups.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground">
                Daily Contribution Log Frequency
              </Label>
              <div className="bg-muted rounded-md p-1 grid grid-cols-1 sm:grid-cols-3 gap-1">
                {[
                  { id: "realtime", title: "Realtime" },
                  { id: "end_of_day", title: "End of Day" },
                  { id: "weekly", title: "Weekly Only" },
                ].map((item) => {
                  const isSelected = cadence.daily_table_cadence === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateCadence({ daily_table_cadence: item.id as DailyTableCadence })}
                      className={cn(
                        "rounded-md py-1.5 text-xs font-medium transition-all text-center select-none",
                        isSelected
                          ? "bg-card shadow-xs text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.title}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border">
              {/* Weekly Rollup Settings */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-foreground font-medium block">Automatic weekly synthesis</span>
                    <span className="text-[11px] text-muted-foreground">
                      Generate and append weekly rollup table
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cadence.weekly_enabled}
                    onChange={(e) => updateCadence({ weekly_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                  />
                </div>

                <div className={cn("space-y-1.5 transition-opacity", !cadence.weekly_enabled && "opacity-50 pointer-events-none")}>
                  <Label className="text-xs font-medium text-foreground">
                    Weekly Summary Day
                  </Label>
                  <div className="bg-muted rounded-md p-1 flex gap-1">
                    {(["Friday", "Saturday", "Sunday"] as WeeklyDay[]).map((day) => {
                      const isSelected = cadence.weekly_day === day
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={!cadence.weekly_enabled}
                          onClick={() => updateCadence({ weekly_day: day })}
                          className={cn(
                            "flex-1 rounded-md py-1 text-xs font-medium transition-all text-center select-none",
                            isSelected
                              ? "bg-card shadow-xs text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Monthly Appraisal Dossier */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs bg-muted/20">
                  <div className="space-y-0.5">
                    <span className="text-foreground font-medium block">Automatic month-end synthesis</span>
                    <span className="text-[11px] text-muted-foreground">
                      Full performance appraisal dossier
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={cadence.monthly_enabled}
                    onChange={(e) => updateCadence({ monthly_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground px-1">
                  Runs automatically on the final day of each calendar month using your configured Gemini API key.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: FastMCP Server Connection */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">FastMCP Server</h2>
              </div>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                Port 8000 (SSE)
              </span>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Connect AI IDEs directly to Tethr to log tasks, update achievements, and sync documents from Cursor, Claude Desktop, Antigravity, or Windsurf.
            </p>

            {/* Quick 1-Click Auth Page link */}
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
              <span className="text-xs font-medium text-foreground block">IDE One-Click Auth</span>
              <p className="text-muted-foreground text-xs leading-snug">
                Authorize IDE tool calls via the standard MCP authorization screen.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/auth/mcp", "_blank")}
                className="w-full text-xs gap-1.5"
              >
                <span>Open /auth/mcp</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* SSE URL Copy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                SSE Endpoint URL
              </Label>
              <div className="flex gap-1.5">
                <Input
                  value="http://localhost:8000/sse"
                  readOnly
                  className="text-xs font-mono select-all"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("http://localhost:8000/sse", "sse")}
                  className="px-2.5 shrink-0"
                >
                  {copiedSseUrl ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Multi-IDE Configuration Snippet Selector */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  IDE MCP Config Snippet
                </Label>
                <button
                  type="button"
                  onClick={() => copyToClipboard(getCurrentMcpSnippet(), "config")}
                  className="text-primary hover:underline text-xs inline-flex items-center gap-1 font-medium cursor-pointer"
                >
                  {copiedConfig ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedConfig ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* IDE Tabs */}
              <div className="bg-muted rounded-md p-1 grid grid-cols-4 gap-1 text-[11px] font-medium">
                {(["cursor", "claude", "windsurf", "antigravity"] as const).map((ide) => (
                  <button
                    key={ide}
                    type="button"
                    onClick={() => setActiveMcpClient(ide)}
                    className={cn(
                      "py-1 rounded text-center transition-all capitalize select-none",
                      activeMcpClient === ide
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {ide === "antigravity" ? "AGY" : ide}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-muted-foreground font-mono truncate px-1">
                Config file: {getMcpConfigFilePath(activeMcpClient)}
              </div>

              <pre className="rounded-lg border border-border bg-muted/60 p-2.5 font-mono text-[11px] text-foreground overflow-x-auto leading-relaxed">
                {getCurrentMcpSnippet()}
              </pre>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
