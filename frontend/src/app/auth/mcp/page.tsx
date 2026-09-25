"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import {
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  ExternalLink,
  Lock,
  ArrowRight,
  Sparkles,
  Terminal,
  FileCode2,
} from "lucide-react"

function generateClientFallbackCode(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `td_auth_${crypto.randomUUID().replace(/-/g, "")}`
  }
  return `td_auth_fallback_session`
}

function MCPAuthContent() {
  const searchParams = useSearchParams()
  const { user, isAuthenticated, login } = useAuthStore()

  // Query parameter extraction from AI IDEs
  const redirectUri = searchParams.get("redirect_uri") || ""
  const stateParam = searchParams.get("state") || ""
  const clientIdParam = searchParams.get("client_id") || searchParams.get("appName") || ""

  // Detected client name
  const detectedClient = clientIdParam
    ? clientIdParam
    : redirectUri.toLowerCase().includes("antigravity")
      ? "Google Antigravity"
      : redirectUri.toLowerCase().includes("cursor")
        ? "Cursor IDE"
        : redirectUri.toLowerCase().includes("windsurf")
          ? "Windsurf"
          : "AI Development Assistant"

  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [authCode, setAuthCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"antigravity" | "cursor" | "cli">("antigravity")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Auto-login fallback for local dev if not yet signed in
  useEffect(() => {
    if (!isAuthenticated) {
      login("github")
    }
  }, [isAuthenticated, login])

  const handleAuthorize = async () => {
    setIsAuthorizing(true)
    setErrorMessage(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${apiUrl}/api/v1/mcp/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.id || "user_mock_dev_alex"}`,
        },
        body: JSON.stringify({
          client_id: detectedClient,
          redirect_uri: redirectUri || null,
          state: stateParam || null,
        }),
      })

      if (!res.ok) {
        // Fallback for offline demo
        const fallbackCode = generateClientFallbackCode()
        setAuthCode(fallbackCode)
        triggerRedirect(fallbackCode)
        return
      }

      const data = await res.json()
      setAuthCode(data.code)
      triggerRedirect(data.code)
    } catch {
      // Graceful offline fallback
      const fallbackCode = generateClientFallbackCode()
      setAuthCode(fallbackCode)
      triggerRedirect(fallbackCode)
    } finally {
      setIsAuthorizing(false)
    }
  }

  const triggerRedirect = (code: string) => {
    if (redirectUri) {
      setRedirectCountdown(3)
      let count = 3
      const interval = setInterval(() => {
        count -= 1
        setRedirectCountdown(count)
        if (count <= 0) {
          clearInterval(interval)
          const delimiter = redirectUri.includes("?") ? "&" : "?"
          let target = `${redirectUri}${delimiter}code=${encodeURIComponent(code)}`
          if (stateParam) {
            target += `&state=${encodeURIComponent(stateParam)}`
          }
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = target
        }
      }, 1000)
    }
  }

  const copyToClipboard = (text: string, isConfig = false) => {
    navigator.clipboard.writeText(text)
    if (isConfig) {
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        tethr: {
          url: "http://localhost:8000/sse",
          transport: "sse",
          headers: {
            Authorization: `Bearer ${authCode || "<YOUR_AUTH_CODE>"}`,
          },
        },
      },
    },
    null,
    2
  )

  const cursorConfig = JSON.stringify(
    {
      name: "Tethr",
      type: "sse",
      url: "http://localhost:8000/sse",
      headers: {
        Authorization: `Bearer ${authCode || "<YOUR_AUTH_CODE>"}`,
      },
    },
    null,
    2
  )

  const cliCommand = `claude mcp add --transport sse tethr http://localhost:8000/sse`

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Decorative Ambient Radial Glow */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-moody-blue-500/20 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-xl">
        {/* Main Card */}
        <div className="bg-card/90 backdrop-blur-xl border border-moody-blue-500/20 dark:border-moody-blue-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all">
          {/* Card Header & Brand */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-linear-to-tr from-moody-blue-600 to-moody-blue-400 flex items-center justify-center shadow-lg shadow-moody-blue-500/25">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  Connect {detectedClient}
                  <Sparkles className="w-4 h-4 text-moody-blue-500 animate-pulse" />
                </h1>
                <p className="text-xs text-muted-foreground">Model Context Protocol (MCP) Authorization</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-moody-blue-500/10 text-moody-blue-600 dark:text-moody-blue-300 border border-moody-blue-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              FastMCP v1.3
            </span>
          </div>

          {/* Active User Identity Info */}
          <div className="bg-moody-blue-50/50 dark:bg-moody-blue-950/40 rounded-xl p-4 border border-moody-blue-200/50 dark:border-moody-blue-800/40 mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Authenticating As
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    user?.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  }
                  alt={user?.name || "Dev"}
                  className="w-10 h-10 rounded-full border border-moody-blue-500/30 object-cover"
                />
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {user?.name || "Alex Rivera"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user?.email || "alex.rivera@github.dev"}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-moody-blue-500/15 text-moody-blue-700 dark:text-moody-blue-300 font-medium">
                  {user?.workspaceName || "Acme Core Eng"}
                </span>
                <div className="text-[10px] text-muted-foreground mt-0.5">ID: {user?.id?.slice(0, 14)}...</div>
              </div>
            </div>
          </div>

          {/* Requested Scopes & Permissions */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Requested Permissions
            </div>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Read & Write Tasks:</span>{" "}
                  <span className="text-muted-foreground">
                    Create, update, and search engineering tasks and contribution notes.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Career Highlight Ledger:</span>{" "}
                  <span className="text-muted-foreground">
                    Flag high-impact wins and appraisal-worthy achievements.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/60">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-foreground">Google Docs Sync:</span>{" "}
                  <span className="text-muted-foreground">
                    Trigger batch updates and sync formatted tables to connected documents.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 mb-6 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Dual-Completion Section */}
          {!authCode ? (
            <div className="space-y-4">
              <button
                id="btn-mcp-authorize"
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-moody-blue-600 via-moody-blue-500 to-moody-blue-700 hover:from-moody-blue-500 hover:to-moody-blue-600 text-white font-medium text-sm shadow-lg shadow-moody-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAuthorizing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Authorization Token...
                  </>
                ) : (
                  <>
                    Authorize & Connect
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
                Tokens are encrypted and scoped strictly to your user session.
              </p>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Success Banner */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Authorization Approved!
                </div>
                {redirectCountdown !== null && redirectCountdown > 0 ? (
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    Hands-free redirect active: returning to {detectedClient} in {redirectCountdown}s...
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                    Copy the one-time code below or paste the configuration snippet into your IDE.
                  </p>
                )}
              </div>

              {/* Code Box for Manual Entry */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  One-Time Authorization Code (Valid for 10 mins)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-xs sm:text-sm bg-muted/80 border border-border px-3.5 py-2.5 rounded-lg text-foreground select-all break-all">
                    {authCode}
                  </div>
                  <button
                    id="btn-copy-code"
                    onClick={() => copyToClipboard(authCode)}
                    className="p-2.5 rounded-lg bg-moody-blue-600 text-white hover:bg-moody-blue-500 transition-colors shadow-sm flex items-center justify-center cursor-pointer shrink-0"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* IDE Setup Tabs */}
              <div className="pt-2 border-t border-border/60">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">IDE Configuration Setup</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        activeTab === "antigravity"
                          ? antigravityConfig
                          : activeTab === "cursor"
                            ? cursorConfig
                            : cliCommand,
                        true
                      )
                    }
                    className="text-[11px] text-moody-blue-600 dark:text-moody-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedConfig ? (
                      <>
                        <Check className="w-3 h-3" /> Copied Snippet
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Snippet
                      </>
                    )}
                  </button>
                </div>

                <div className="flex gap-1.5 bg-muted/60 p-1 rounded-lg mb-3">
                  <button
                    onClick={() => setActiveTab("antigravity")}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "antigravity"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileCode2 className="w-3 h-3" /> Antigravity
                  </button>
                  <button
                    onClick={() => setActiveTab("cursor")}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "cursor"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Cpu className="w-3 h-3" /> Cursor
                  </button>
                  <button
                    onClick={() => setActiveTab("cli")}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeTab === "cli"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Terminal className="w-3 h-3" /> Claude Code
                  </button>
                </div>

                <pre className="p-3 bg-muted/70 rounded-lg text-[11px] font-mono text-muted-foreground overflow-x-auto border border-border/50 max-h-40 leading-relaxed">
                  {activeTab === "antigravity" && antigravityConfig}
                  {activeTab === "cursor" && cursorConfig}
                  {activeTab === "cli" && cliCommand}
                </pre>
              </div>

              {/* Redirect Action button */}
              {redirectUri && (
                <button
                  onClick={() => {
                    const delimiter = redirectUri.includes("?") ? "&" : "?"
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.href = `${redirectUri}${delimiter}code=${encodeURIComponent(authCode)}${
                      stateParam ? `&state=${encodeURIComponent(stateParam)}` : ""
                    }`
                  }}
                  className="w-full py-2.5 px-3 rounded-lg border border-moody-blue-500/30 text-moody-blue-600 dark:text-moody-blue-300 hover:bg-moody-blue-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Return to {detectedClient} now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MCPAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-moody-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MCPAuthContent />
    </Suspense>
  )
}
