"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { FileText, ArrowRight, ShieldCheck } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/useAuthStore"

export default function SignInPage() {
  const router = useRouter()
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const { login } = useAuthStore()

  const handleOAuthSignIn = (provider: "github" | "google") => {
    setLoadingProvider(provider)
    // Mimic OAuth network redirect roundtrip
    setTimeout(() => {
      login(provider)
      setLoadingProvider(null)
      router.push("/")
    }, 600)
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-3.5 py-8 sm:px-4 sm:py-12">
      {/* Background ambient lighting */}
      <div className="bg-moody-blue-500/10 dark:bg-moody-blue-500/15 pointer-events-none absolute top-1/3 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="glass-panel border-border/80 shadow-moody-blue-900/5 space-y-6 rounded-3xl border p-6 shadow-2xl backdrop-blur-xl sm:p-8 dark:shadow-black/40">
          {/* Header inside the panel */}
          <div className="space-y-3 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="from-moody-blue-600 to-moody-blue-800 shadow-moody-blue-600/30 border-moody-blue-400/30 inline-flex h-12 w-12 items-center justify-center rounded-2xl border bg-linear-to-br text-white shadow-lg"
            >
              <FileText className="h-6 w-6" />
            </motion.div>
            <div className="space-y-1.5">
              <h1 className="text-foreground text-2xl leading-[1.2] font-bold tracking-tight sm:text-3xl">
                Welcome back to{" "}
                <span className="from-moody-blue-600 to-moody-blue-400 bg-linear-to-r bg-clip-text text-transparent">
                  Tethr
                </span>
              </h1>
              <p className="text-muted-foreground mx-auto max-w-xs text-sm leading-normal font-normal">
                Choose your developer identity provider to access your multi-tenant workspace
              </p>
            </div>
          </div>

          {/* Developer OAuth Options */}
          <div className="space-y-3 pt-1">
            {/* GitHub OAuth Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn("github")}
                disabled={loadingProvider !== null}
                className="border-border/80 bg-foreground/5 hover:bg-foreground/10 dark:bg-card dark:hover:bg-muted/60 text-foreground group flex h-13 w-full cursor-pointer items-center justify-between rounded-xl px-4 font-medium shadow-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-foreground text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-foreground flex items-center gap-1.5 text-sm font-semibold tracking-tight">
                      <span>Continue with GitHub</span>
                      <span className="bg-moody-blue-500/15 text-moody-blue-600 dark:text-moody-blue-400 border-moody-blue-500/20 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Recommended
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Sign in with your GitHub developer account
                    </p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-all group-hover:translate-x-0.5" />
              </Button>
            </motion.div>

            {/* Google OAuth Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loadingProvider !== null}
                className="border-border/80 bg-background hover:bg-muted/50 text-foreground group flex h-13 w-full cursor-pointer items-center justify-between rounded-xl px-4 font-medium shadow-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-card border-border/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-xs">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-foreground text-sm font-semibold tracking-tight">
                      Continue with Google
                    </div>
                    <p className="text-muted-foreground text-xs">Work or personal Google account</p>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-all group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          </div>

          {/* Security & Multi-tenancy Reassurance */}
          <div className="border-border/50 border-t pt-2">
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-xs">
              <ShieldCheck className="text-moody-blue-600 dark:text-moody-blue-400 h-4 w-4" />
              <span>Passwordless OAuth 2.0 authenticated via Clerk</span>
            </div>
          </div>

          {/* Switch link */}
          <div className="text-muted-foreground border-border/40 border-t pt-1 text-center text-xs font-normal">
            New to Tethr?{" "}
            <Link
              href="/sign-up"
              className="text-moody-blue-600 dark:text-moody-blue-400 font-semibold hover:underline"
            >
              Create developer account
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
