"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react"

import { authFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useIntegrationStore } from "@/store/useIntegrationStore"
import { useTaskStore } from "@/store/useTaskStore"

interface ChecklistItem {
  id: string
  label: string
  hint: string
  href: string
  // null while still loading
  done: boolean | null
}

// The last onboarding step: what the user has actually set up so far, each linking to where
// the rest gets done
export function SetupChecklist({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { tasks, fetchTasks, isLoading: isLoadingTasks } = useTaskStore()
  const { isConnected, statusLoaded, fetchStatus } = useIntegrationStore()
  const [hasTasksLoaded, setHasTasksLoaded] = React.useState(false)
  const [ideConnected, setIdeConnected] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchTasks().finally(() => {
      if (!cancelled) setHasTasksLoaded(true)
    })
    fetchStatus()
    authFetch("/api/v1/mcp/connections")
      .then(async (res) => {
        const connections: unknown = res.ok ? await res.json() : []
        if (!cancelled) setIdeConnected(Array.isArray(connections) && connections.length > 0)
      })
      .catch(() => {
        if (!cancelled) setIdeConnected(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchTasks, fetchStatus])

  const items: ChecklistItem[] = [
    {
      id: "google",
      label: "Connect Google Docs",
      hint: "Pick the document your impact ledger syncs to",
      href: "/settings",
      done: statusLoaded ? isConnected : null,
    },
    {
      id: "ide",
      label: "Authorize your AI IDE",
      hint: "Add the MCP config snippet and approve the connection",
      href: "/settings",
      done: ideConnected,
    },
    {
      id: "task",
      label: "Log your first task",
      hint: "From the dashboard, or ask your assistant",
      href: "/",
      done: hasTasksLoaded && !isLoadingTasks ? tasks.length > 0 : null,
    },
  ]

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + index * 0.08 }}
        >
          <button
            type="button"
            onClick={() => onNavigate(item.href)}
            className={cn(
              "group border-border hover:border-primary/50 hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
              item.done && "border-success/30 bg-success/5"
            )}
          >
            {item.done === null ? (
              <Loader2 className="text-muted-foreground h-5 w-5 shrink-0 animate-spin" />
            ) : item.done ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <CheckCircle2 className="text-success h-5 w-5 shrink-0" />
              </motion.span>
            ) : (
              <Circle className="text-muted-foreground/60 h-5 w-5 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "text-foreground block text-sm font-medium",
                  item.done && "text-muted-foreground line-through"
                )}
              >
                {item.label}
              </span>
              <span className="text-muted-foreground block text-xs">{item.hint}</span>
            </span>
            <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.li>
      ))}
    </ul>
  )
}
