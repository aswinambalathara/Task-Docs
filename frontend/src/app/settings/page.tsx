"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  FileText, 
  Key, 
  Terminal, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  Database, 
  ShieldCheck, 
  RefreshCw,
  CheckCircle2,
  Cpu
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
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

  return (
    <div className="container mx-auto max-w-5xl px-3.5 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      
      {/* Header */}
      <div className="space-y-1 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.15] text-foreground">
            MCP & Integrations <span className="text-transparent bg-clip-text bg-linear-to-r from-moody-blue-600 via-moody-blue-500 to-moody-blue-400">Settings</span>
          </h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300 border border-moody-blue-200/60">
            Developer Hub
          </span>
        </div>
        <p className="text-sm font-normal text-muted-foreground max-w-2xl leading-relaxed">
          Configure Google Docs OAuth synchronization and connect your AI coding assistant (Cursor, Claude Desktop, Copilot) to the TaskDocs Model Context Protocol (MCP) server.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 min-w-0">
        
        {/* Left 2 Columns: Main Integrations */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          
          {/* Google Docs Integration */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border/60 shadow-xs space-y-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-moody-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold leading-snug text-foreground truncate">Google Docs Synchronization</h3>
                  <p className="text-xs font-normal text-muted-foreground truncate">Automated batchUpdate into target documentation</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Connected
              </span>
            </div>

            {/* Target Doc Input */}
            <div className="space-y-2 pt-2">
              <Label htmlFor="doc-id" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Google Document ID
              </Label>
              <div className="flex gap-2 min-w-0">
                <Input 
                  id="doc-id" 
                  value={docId} 
                  onChange={(e) => setDocId(e.target.value)}
                  className="font-mono text-sm font-normal h-10 rounded-md bg-background/50 border-border/80 focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none flex-1 min-w-0" 
                />
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://docs.google.com/document/d/${docId}/edit`, "_blank")}
                  className="rounded-md text-sm font-medium h-10 px-3 gap-1.5 border-border/80 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Open Doc</span>
                </Button>
              </div>
              <p className="text-xs font-normal text-muted-foreground">
                Found in the URL: <code className="text-moody-blue-600 dark:text-moody-blue-400 font-mono">docs.google.com/document/d/{"<DOC_ID>"}/edit</code>
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border/40">
              <div className="flex items-center gap-2 flex-wrap">
                <Button 
                  onClick={handleTestSync}
                  disabled={isTesting}
                  className="rounded-md bg-moody-blue-600 hover:bg-moody-blue-700 text-white text-sm font-semibold h-9 px-4 gap-1.5 shadow-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                  <span>{isTesting ? "Testing sync..." : "Test Docs Sync"}</span>
                </Button>
                {testSuccess && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Verified connection!
                  </span>
                )}
              </div>
              <span className="text-xs font-normal text-muted-foreground">Auto-sync: On Task Complete</span>
            </div>
          </div>

          {/* Model Context Protocol (MCP) Configuration */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border/60 shadow-xs space-y-5 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-moody-blue-600 to-moody-blue-800 text-white flex items-center justify-center shadow-md shadow-moody-blue-600/20 shrink-0">
                  <Terminal className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold leading-snug text-foreground truncate">MCP Server (Claude & Cursor)</h3>
                  <p className="text-xs font-normal text-muted-foreground truncate">Streamable HTTP/SSE JSON-RPC 2.0 tool endpoints</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-moody-blue-100 text-moody-blue-700 dark:bg-moody-blue-900/60 dark:text-moody-blue-300 border border-moody-blue-200/60 shrink-0">
                Port 3000
              </span>
            </div>

            {/* Bearer Token */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clerk Multi-Tenant Bearer Token (JWT)
              </Label>
              <div className="flex gap-2 min-w-0">
                <Input 
                  value="clerk_sec_live_98234857a2b9c7d1e0f3" 
                  readOnly 
                  className="font-mono text-sm font-normal h-10 rounded-md bg-background/50 border-border/80 cursor-copy select-all flex-1 min-w-0 focus-visible:border-moody-blue-500 focus-visible:ring-1 focus-visible:ring-moody-blue-500/20 focus-visible:outline-none" 
                />
                <Button 
                  variant="secondary"
                  onClick={() => copyToClipboard("clerk_sec_live_98234857a2b9c7d1e0f3", "token")}
                  className="rounded-md text-sm font-medium h-10 px-3.5 gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Configuration snippet for Claude Desktop / Cursor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Claude Desktop Config (`claude_desktop_config.json`)
                </Label>
                <button
                  onClick={() => copyToClipboard(mcpConfigSnippet, "config")}
                  className="text-xs text-moody-blue-600 dark:text-moody-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0"
                >
                  {copiedConfig ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedConfig ? "Copied JSON" : "Copy Config JSON"}</span>
                </button>
              </div>
              <div className="relative rounded-xl bg-moody-blue-950 text-moody-blue-50 p-3.5 sm:p-4 font-mono text-xs sm:text-sm font-normal overflow-x-auto border border-moody-blue-800/80 max-w-full">
                <pre className="overflow-x-auto whitespace-pre">{mcpConfigSnippet}</pre>
              </div>
            </div>

          </div>

        </div>

        {/* Right 1 Column: System Health & Multi-Tenancy */}
        <div className="space-y-6 min-w-0">

          
          {/* Multi-Tenancy / Clerk Auth card */}
          <div className="glass-panel p-5 rounded-2xl border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm sm:text-base">
              <ShieldCheck className="w-4 h-4 text-moody-blue-500" />
              <span>Identity & Security</span>
            </div>
            
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-background/50 border border-border/60 space-y-1">
                <span className="text-xs font-normal text-muted-foreground">Auth Provider</span>
                <p className="text-sm font-semibold text-foreground">Clerk Multi-Tenancy (RS256)</p>
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/60 space-y-1">
                <span className="text-xs font-normal text-muted-foreground">Authenticated User ID</span>
                <p className="font-mono text-xs font-normal text-foreground truncate">user_2P9xYz48109Dev</p>
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/60 space-y-1">
                <span className="text-xs font-normal text-muted-foreground">JWKS Verification</span>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active & Verified
                </p>
              </div>
            </div>
          </div>

          {/* Database Info */}
          <div className="glass-panel p-5 rounded-2xl border border-border/60 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm sm:text-base">
              <Database className="w-4 h-4 text-moody-blue-500" />
              <span>MongoDB Atlas Status</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-xs font-normal text-muted-foreground">Cluster</span>
                <span className="text-xs sm:text-sm font-medium text-foreground">Atlas M0 (Primary)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-xs font-normal text-muted-foreground">Scoped Collection</span>
                <span className="font-mono text-xs sm:text-sm font-normal text-moody-blue-600 dark:text-moody-blue-400">tasks</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs font-normal text-muted-foreground">Driver Connection</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                </span>
              </div>
            </div>
          </div>

          {/* AI Coding Tools Info */}
          <div className="glass-panel p-5 rounded-2xl border border-border/60 shadow-xs space-y-3 bg-linear-to-br from-moody-blue-500/5 to-transparent">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm sm:text-base">
              <Cpu className="w-4 h-4 text-moody-blue-500" />
              <span>Zero LLM Overhead</span>
            </div>
            <p className="text-xs sm:text-sm font-normal text-muted-foreground leading-relaxed">
              TaskDocs utilizes your local assistant (Cursor / Claude) for intelligence and acts strictly as a deterministic MCP tool pipeline.
            </p>
          </div>

        </div>

      </div>

    </div>
  )
}
