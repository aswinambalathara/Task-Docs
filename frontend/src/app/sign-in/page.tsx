"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { FileText, ArrowRight, ShieldCheck, Sparkles, CheckCircle2, Loader2, LogOut } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/useAuthStore"

export default function SignInPage() {
  const router = useRouter()
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const { isAuthenticated, user, login, logout } = useAuthStore()

  React.useEffect(() => {
    setMounted(true)
  }, [])

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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-3.5 sm:px-4 py-8 sm:py-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-moody-blue-500/10 dark:bg-moody-blue-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="p-6 sm:p-8 rounded-3xl glass-panel border border-border/80 shadow-2xl shadow-moody-blue-900/5 dark:shadow-black/40 space-y-6 backdrop-blur-xl">
          {/* Header inside the panel */}
          <div className="text-center space-y-3">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-linear-to-br from-moody-blue-600 to-moody-blue-800 text-white shadow-lg shadow-moody-blue-600/30 border border-moody-blue-400/30"
            >
              <FileText className="w-6 h-6" />
            </motion.div>
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-[1.2] text-foreground">
                Welcome back to <span className="text-transparent bg-clip-text bg-linear-to-r from-moody-blue-600 to-moody-blue-400">TaskDocs</span>
              </h1>
              <p className="text-sm font-normal text-muted-foreground leading-normal max-w-xs mx-auto">
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
                className="w-full h-13 rounded-xl border-border/80 bg-foreground/5 hover:bg-foreground/10 dark:bg-card dark:hover:bg-muted/60 text-foreground font-medium flex items-center justify-between px-4 transition-all group shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                      <span>Continue with GitHub</span>
                      <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-full bg-moody-blue-500/15 text-moody-blue-600 dark:text-moody-blue-400 border border-moody-blue-500/20">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Sign in with your GitHub developer account</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Button>
            </motion.div>

            {/* Google OAuth Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loadingProvider !== null}
                className="w-full h-13 rounded-xl border-border/80 bg-background hover:bg-muted/50 text-foreground font-medium flex items-center justify-between px-4 transition-all group shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold tracking-tight text-foreground">
                      Continue with Google
                    </div>
                    <p className="text-xs text-muted-foreground">Work or personal Google account</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Button>
            </motion.div>
          </div>

          {/* Security & Multi-tenancy Reassurance */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <ShieldCheck className="w-4 h-4 text-moody-blue-600 dark:text-moody-blue-400" />
              <span>Passwordless OAuth 2.0 authenticated via Clerk</span>
            </div>
          </div>

          {/* Switch link */}
          <div className="pt-1 text-center text-xs font-normal text-muted-foreground border-t border-border/40">
            New to TaskDocs?{" "}
            <Link href="/sign-up" className="font-semibold text-moody-blue-600 dark:text-moody-blue-400 hover:underline">
              Create developer account
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

