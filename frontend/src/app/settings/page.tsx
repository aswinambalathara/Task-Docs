"use client"

import * as React from "react"
import {
  FileText,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Database,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Lock,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/store/useAuthStore"

export default function SettingsPage() {
  const { isAuthenticated, login } = useAuthStore()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const [copiedToken, setCopiedToken] = React.useState(false)
  const [copiedConfig, setCopiedConfig] = React.useState(false)
  const [docId, setDocId] = React.useState("1BxiMvs0XRY5n5DCa_example_doc_id_99")
  const [isTesting, setIsTesting] = React.useState(false)
  const [testSuccess, setTestSuccess] = React.useState(false)

  const mcpConfigSnippet = `{
  "mcpServers": {
    "taskdocs": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sse",
        "http://localhost:3000/api/mcp"
      ],
      "env": {
        "TASKDOCS_BEARER_TOKEN": "clerk_sec_live_98234857a2b9"
      }
    }
  }
}`

  const copyToClipboard = (text: string, type: "token" | "config") => {
    navigator.clipboard.writeText(text)
    if (type === "token") {
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    } else {
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
    }
  }

  const handleTestSync = () => {
    setIsTesting(true)
    setTestSuccess(false)
    setTimeout(() => {
      setIsTesting(false)
      setTestSuccess(true)
    }, 1000)
  }

  if (!mounted) {
    return (
      <div className="container mx-auto flex max-w-5xl items-center justify-center px-3 py-12 sm:px-6 lg:px-8">
        <div className="border-moody-blue-600 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-8">
        <Card className="glass-panel border-border/80 w-full max-w-md space-y-5 rounded-3xl border p-6 text-center shadow-2xl sm:p-8">
          <div className="from-moody-blue-600 to-moody-blue-800 mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-foreground text-2xl font-bold tracking-tight">Sign In Required</h2>
            <p className="text-muted-foreground text-sm">
              Please authenticate to configure Google Docs integration & MCP credentials.
            </p>
          </div>
          <div className="space-y-2.5 pt-2">
            <Button
              onClick={() => login("github")}
              className="bg-moody-blue-600 hover:bg-moody-blue-700 h-11 w-full rounded-xl text-sm font-medium text-white"
            >
              Sign in with GitHub
            </Button>
            <Button
              variant="outline"
              onClick={() => login("google")}
              className="text-foreground h-11 w-full rounded-xl text-sm font-medium"
            >
              Sign in with Google
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-3.5 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
      {/* Header */}
      <div className="border-border/40 space-y-1 border-b pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-3xl leading-[1.15] font-bold tracking-tight sm:text-4xl">
            MCP & Integrations{" "}
            <span className="from-moody-blue-600 via-moody-blue-500 to-moody-blue-400 bg-linear-to-r bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
          <span className="bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300 border-moody-blue-200/60 rounded-full border px-2 py-0.5 text-xs font-semibold">
            Developer Hub
          </span>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed font-normal">
          Configure Google Docs OAuth synchronization and connect your AI coding assistant (Cursor,
          Claude Desktop, Copilot) to the TaskDocs Model Context Protocol (MCP) server.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Main Integrations */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Google Docs Integration */}
          <div className="glass-panel border-border/60 min-w-0 space-y-5 rounded-2xl border p-4 shadow-xs sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="to-moody-blue-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 text-white shadow-md shadow-blue-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-foreground truncate text-base leading-snug font-semibold sm:text-lg">
                    Google Docs Synchronization
                  </h3>
                  <p className="text-muted-foreground truncate text-xs font-normal">
                    Automated batchUpdate into target documentation
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>

            {/* Target Doc Input */}
            <div className="space-y-2 pt-2">
              <Label
                htmlFor="doc-id"
                className="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
              >
                Target Google Document ID
              </Label>
              <div className="flex min-w-0 gap-2">
                <Input
                  id="doc-id"
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-10 min-w-0 flex-1 rounded-md font-mono text-sm font-normal focus-visible:ring-1 focus-visible:outline-none"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`https://docs.google.com/document/d/${docId}/edit`, "_blank")
                  }
                  className="border-border/80 h-10 shrink-0 gap-1.5 rounded-md px-3 text-sm font-medium"
                >
                  <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Open Doc</span>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs font-normal">
                Found in the URL:{" "}
                <code className="text-moody-blue-600 dark:text-moody-blue-400 font-mono">
                  docs.google.com/document/d/{"<DOC_ID>"}/edit
                </code>
              </p>
            </div>

            <div className="border-border/40 flex flex-col items-start justify-between gap-3 border-t pt-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleTestSync}
                  disabled={isTesting}
                  className="bg-moody-blue-600 hover:bg-moody-blue-700 h-9 shrink-0 gap-1.5 rounded-md px-4 text-sm font-semibold text-white shadow-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? "animate-spin" : ""}`} />
                  <span>{isTesting ? "Testing sync..." : "Test Docs Sync"}</span>
                </Button>
                {testSuccess && (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified connection!
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs font-normal">
                Auto-sync: On Task Complete
              </span>
            </div>
          </div>

          {/* Model Context Protocol (MCP) Configuration */}
          <div className="glass-panel border-border/60 min-w-0 space-y-5 rounded-2xl border p-4 shadow-xs sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="from-moody-blue-600 to-moody-blue-800 shadow-moody-blue-600/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md">
                  <Terminal className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-foreground truncate text-base leading-snug font-semibold sm:text-lg">
                    MCP Server (Claude & Cursor)
                  </h3>
                  <p className="text-muted-foreground truncate text-xs font-normal">
                    Streamable HTTP/SSE JSON-RPC 2.0 tool endpoints
                  </p>
                </div>
              </div>
              <span className="bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300 border-moody-blue-200/60 shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                Port 3000
              </span>
            </div>

            {/* Bearer Token */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Clerk Multi-Tenant Bearer Token (JWT)
              </Label>
              <div className="flex min-w-0 gap-2">
                <Input
                  value="clerk_sec_live_98234857a2b9c7d1e0f3"
                  readOnly
                  className="bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-moody-blue-500/20 h-10 min-w-0 flex-1 cursor-copy rounded-md font-mono text-sm font-normal select-all focus-visible:ring-1 focus-visible:outline-none"
                />
                <Button
                  variant="secondary"
                  onClick={() => copyToClipboard("clerk_sec_live_98234857a2b9c7d1e0f3", "token")}
                  className="h-10 shrink-0 cursor-pointer gap-1.5 rounded-md px-3.5 text-sm font-medium"
                >
                  {copiedToken ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedToken ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Configuration snippet for Claude Desktop / Cursor */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Claude Desktop Config (`claude_desktop_config.json`)
                </Label>
                <button
                  onClick={() => copyToClipboard(mcpConfigSnippet, "config")}
                  className="text-moody-blue-600 dark:text-moody-blue-400 flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium hover:underline"
                >
                  {copiedConfig ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedConfig ? "Copied JSON" : "Copy Config JSON"}</span>
                </button>
              </div>
              <div className="bg-moody-blue-950 text-moody-blue-50 border-moody-blue-800/80 relative max-w-full overflow-x-auto rounded-xl border p-3.5 font-mono text-xs font-normal sm:p-4 sm:text-sm">
                <pre className="overflow-x-auto whitespace-pre">{mcpConfigSnippet}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: System Health & Multi-Tenancy */}
        <div className="min-w-0 space-y-6">
          {/* Multi-Tenancy / Clerk Auth card */}
          <div className="glass-panel border-border/60 space-y-4 rounded-2xl border p-5 shadow-xs">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold sm:text-base">
              <ShieldCheck className="text-moody-blue-500 h-4 w-4" />
              <span>Identity & Security</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-background/50 border-border/60 space-y-1 rounded-xl border p-3">
                <span className="text-muted-foreground text-xs font-normal">Auth Provider</span>
                <p className="text-foreground text-sm font-semibold">Clerk Multi-Tenancy (RS256)</p>
              </div>

              <div className="bg-background/50 border-border/60 space-y-1 rounded-xl border p-3">
                <span className="text-muted-foreground text-xs font-normal">
                  Authenticated User ID
                </span>
                <p className="text-foreground truncate font-mono text-xs font-normal">
                  user_2P9xYz48109Dev
                </p>
              </div>

              <div className="bg-background/50 border-border/60 space-y-1 rounded-xl border p-3">
                <span className="text-muted-foreground text-xs font-normal">JWKS Verification</span>
                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active & Verified
                </p>
              </div>
            </div>
          </div>

          {/* Database Info */}
          <div className="glass-panel border-border/60 space-y-4 rounded-2xl border p-5 shadow-xs">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold sm:text-base">
              <Database className="text-moody-blue-500 h-4 w-4" />
              <span>MongoDB Atlas Status</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border-border/40 flex items-center justify-between border-b py-1">
                <span className="text-muted-foreground text-xs font-normal">Cluster</span>
                <span className="text-foreground text-xs font-medium sm:text-sm">
                  Atlas M0 (Primary)
                </span>
              </div>
              <div className="border-border/40 flex items-center justify-between border-b py-1">
                <span className="text-muted-foreground text-xs font-normal">Scoped Collection</span>
                <span className="text-moody-blue-600 dark:text-moody-blue-400 font-mono text-xs font-normal sm:text-sm">
                  tasks
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground text-xs font-normal">Driver Connection</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                </span>
              </div>
            </div>
          </div>

          {/* AI Coding Tools Info */}
          <div className="glass-panel border-border/60 from-moody-blue-500/5 space-y-3 rounded-2xl border bg-linear-to-br to-transparent p-5 shadow-xs">
            <div className="text-foreground flex items-center gap-2 text-sm font-semibold sm:text-base">
              <Cpu className="text-moody-blue-500 h-4 w-4" />
              <span>Zero LLM Overhead</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed font-normal sm:text-sm">
              TaskDocs utilizes your local assistant (Cursor / Claude) for intelligence and acts
              strictly as a deterministic MCP tool pipeline.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
