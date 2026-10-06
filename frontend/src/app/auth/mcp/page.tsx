"use client"

import * as React from "react"
import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import {
  Check,
  Copy,
  ExternalLink,
  Lock,
  HelpCircle,
  Terminal,
  ShieldCheck,
  Sparkles,
  Info,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function MCPAuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { getToken, isSignedIn } = useAuth()

  // Query parameter extraction from AI IDEs
  const redirectUri = searchParams.get("redirect_uri") || ""
  const stateParam = searchParams.get("state") || ""
  const clientIdParam = searchParams.get("client_id") || searchParams.get("appName") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256"

  // Detected client name
  const detectedClient = clientIdParam
    ? clientIdParam
    : redirectUri.toLowerCase().includes("antigravity")
      ? "Google Antigravity"
      : redirectUri.toLowerCase().includes("cursor")
        ? "Cursor IDE"
        : redirectUri.toLowerCase().includes("windsurf")
          ? "Windsurf"
          : "AI Assistant"

  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [authCode, setAuthCode] = useState<string | null>(null)
  const [mcpJwtToken, setMcpJwtToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"cursor" | "claude" | "windsurf" | "antigravity">("cursor")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showCodeHelp, setShowCodeHelp] = useState(false)

  const handleAuthorize = async () => {
    if (!isSignedIn) {
      const currentUrl = typeof window !== "undefined" ? window.location.href : "/auth/mcp"
      router.push(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`)
      return
    }

    setIsAuthorizing(true)
    setErrorMessage(null)

    try {
      const clerkToken = await getToken()
      if (!clerkToken) {
        throw new Error("Could not retrieve active session. Please sign in again.")
      }

      const res = await fetch("/api/v1/mcp/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          client_id: detectedClient,
          redirect_uri: redirectUri || null,
          state: stateParam || null,
          code_challenge: codeChallenge || null,
          code_challenge_method: codeChallengeMethod || null,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Authorization request rejected by server.")
      }

      const data = await res.json()
      setAuthCode(data.code)

      if (redirectUri) {
        // IDE-initiated OAuth: the code is single-use and the IDE exchanges it itself
        // (with its PKCE verifier), so it must not be redeemed here.
        triggerRedirect(data.code)
      } else {
        // Manual setup: exchange the code now so the config snippets contain a real token
        try {
          const tokenRes = await fetch("/api/v1/mcp/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: data.code }),
          })
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json()
            setMcpJwtToken(tokenData.access_token)
          }
        } catch (e) {
          console.error("Token exchange failed:", e)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authorization failed."
      setErrorMessage(message)
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
          window.location.assign(target)
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

  // An authorization code is not a bearer token, so never put it in the config snippets
  const tokenToDisplay = mcpJwtToken || "<YOUR_MCP_TOKEN>"

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        tethr: {
          url: "http://localhost:8000/sse",
          headers: {
            Authorization: `Bearer ${tokenToDisplay}`,
          },
        },
      },
    },
    null,
    2
  )

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        tethr: {
          url: "http://localhost:8000/sse",
          headers: {
            Authorization: `Bearer ${tokenToDisplay}`,
          },
        },
      },
    },
    null,
    2
  )

  const windsurfConfig = JSON.stringify(
    {
      mcpServers: {
        tethr: {
          serverUrl: "http://localhost:8000/sse",
          headers: {
            Authorization: `Bearer ${tokenToDisplay}`,
          },
        },
      },
    },
    null,
    2
  )

  const antigravityConfig = JSON.stringify(
    {
      mcpServers: {
        tethr: {
          url: "http://localhost:8000/sse",
          headers: {
            Authorization: `Bearer ${tokenToDisplay}`,
          },
        },
      },
    },
    null,
    2
  )

  const getActiveConfig = () => {
    switch (activeTab) {
      case "cursor":
        return cursorConfig
      case "claude":
        return claudeConfig
      case "windsurf":
        return windsurfConfig
      case "antigravity":
        return antigravityConfig
    }
  }

  const getFilePath = () => {
    switch (activeTab) {
      case "cursor":
        return "~/.cursor/mcp.json or project .cursor/mcp.json"
      case "claude":
        return "%APPDATA%/Claude/claude_desktop_config.json"
      case "windsurf":
        return "~/.codeium/windsurf/mcp_config.json"
      case "antigravity":
        return "~/.gemini/config/mcp_config.json"
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 bg-background">
      <div className="w-full max-w-xl">
        <Card className="p-6 sm:p-8 space-y-6 shadow-xl border-border/80">
          {/* Header */}
          <div className="space-y-1.5 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Tethr FastMCP Bridge
              </span>
              <span className="text-[11px] font-medium bg-muted px-2 py-0.5 rounded text-muted-foreground">
                OAuth 2.0 PKCE
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Authorize AI IDE Connection
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Grant <span className="font-semibold text-foreground">{detectedClient}</span> secure permission to query tasks, log engineering contributions, and sync your Google Docs ledger.
            </p>
          </div>

          {/* User identity card */}
          <div className="flex items-center gap-3 rounded-xl border border-border p-3.5 bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                user?.imageUrl ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              }
              alt={user?.fullName || "User"}
              className="w-10 h-10 rounded-full border border-border object-cover"
            />
            <div className="min-w-0 flex-1 text-xs space-y-0.5">
              <div className="font-semibold text-foreground truncate">
                {user?.fullName || user?.username || "Authenticated Developer"}
              </div>
              <div className="text-muted-foreground truncate text-[11px]">
                {user?.primaryEmailAddress?.emailAddress || "developer@tethr.dev"}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] text-success bg-success/10 font-medium px-2 py-1 rounded-full shrink-0">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          </div>

          {/* Requested permissions */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Requested Permissions
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-snug">
                  Read, search, and log engineering milestones & contribution notes.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-snug">
                  Star career highlight items for performance reviews and appraisals.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <span className="text-muted-foreground leading-snug">
                  Trigger batch updates to your configured Google Docs impact table.
                </span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Action section */}
          {!authCode ? (
            <div className="space-y-2.5 pt-2">
              <Button
                id="btn-mcp-authorize"
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="w-full h-10 font-semibold gap-2 shadow-xs"
              >
                <Terminal className="h-4 w-4" />
                <span>{isAuthorizing ? "Generating Credentials..." : "Authorize AI Assistant"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/")}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel and return to dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-xs text-success space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  Authorization Approved
                </p>
                {redirectCountdown !== null && redirectCountdown > 0 ? (
                  <p className="text-muted-foreground text-[11px]">
                    Redirecting back to <span className="font-semibold text-foreground">{detectedClient}</span> in {redirectCountdown}s...
                  </p>
                ) : (
                  <p className="text-muted-foreground text-[11px]">
                    Your authorization code and ready-to-use IDE configurations are generated below.
                  </p>
                )}
              </div>

              {/* One-Time Code Box & Explanation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    One-Time Authorization Code
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCodeHelp(!showCodeHelp)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>What is this code?</span>
                  </button>
                </div>

                {/* Helpful Explainer for the user */}
                {showCodeHelp && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground space-y-1.5 leading-relaxed">
                    <p className="font-semibold flex items-center gap-1.5 text-primary">
                      <Info className="h-3.5 w-3.5" />
                      How does this code work?
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <strong>1. If launched by an IDE:</strong> The IDE opens this browser tab and waits for this code. Clicking &quot;Return to IDE&quot; passes it automatically, and the IDE exchanges it for a permanent session token.
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <strong>2. If configuring manually:</strong> You don&apos;t even have to exchange this code! We already exchanged it for you in the background and injected the resulting token directly into the copy-paste configuration snippets below.
                    </p>
                  </div>
                )}

                <div className="bg-muted border border-border rounded-xl font-mono text-sm tracking-wider text-center p-3 select-all break-all font-semibold">
                  {authCode}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(authCode)}
                  className="w-full gap-1.5 text-xs h-8"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied Authorization Code" : "Copy Code"}</span>
                </Button>
              </div>

              {/* IDE setup snippets with Tabs */}
              <div className="pt-3 border-t border-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground block">
                      Ready-to-Use IDE Configuration
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {getFilePath()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(getActiveConfig(), true)}
                    className="h-7 text-xs gap-1 font-medium"
                  >
                    {copiedConfig ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedConfig ? "Copied" : "Copy Config"}</span>
                  </Button>
                </div>

                {/* Tabs */}
                <div className="bg-muted rounded-lg p-1 grid grid-cols-4 gap-1 text-xs font-medium">
                  {(
                    [
                      { id: "cursor", label: "Cursor" },
                      { id: "claude", label: "Claude" },
                      { id: "windsurf", label: "Windsurf" },
                      { id: "antigravity", label: "AGY" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "py-1 rounded text-center transition-all cursor-pointer select-none",
                        activeTab === tab.id
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Config Pre Block */}
                <pre className="bg-muted/70 border border-border rounded-xl p-3 font-mono text-[11px] text-foreground overflow-x-auto max-h-48 leading-relaxed">
                  {getActiveConfig()}
                </pre>
              </div>

              {redirectUri && (
                <Button
                  variant="default"
                  onClick={() => {
                    const delimiter = redirectUri.includes("?") ? "&" : "?"
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign(
                      `${redirectUri}${delimiter}code=${encodeURIComponent(authCode)}${
                        stateParam ? `&state=${encodeURIComponent(stateParam)}` : ""
                      }`
                    )
                  }}
                  className="w-full text-xs gap-1.5 h-9 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Return to {detectedClient}</span>
                </Button>
              )}
            </div>
          )}

          <div className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-2 border-t border-border/60">
            <Lock className="w-3.5 h-3.5" />
            <span>Authenticated session via Clerk · End-to-End Encrypted</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function MCPAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MCPAuthContent />
    </Suspense>
  )
}
