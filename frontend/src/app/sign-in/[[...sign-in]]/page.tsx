"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { FileText, ArrowRight, ShieldCheck, Loader2 } from "lucide-react"
import { useClerk } from "@clerk/nextjs"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  const clerk = useClerk()
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleOAuthSignIn = async (provider: "oauth_github" | "oauth_google") => {
    if (!clerk.loaded || !clerk.client) return
    setLoadingProvider(provider)
    setErrorMsg(null)

    try {
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: provider,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      })
    } catch (err) {
      setLoadingProvider(null)
      const message = err instanceof Error ? err.message : "Failed to initiate sign-in"
      setErrorMsg(message)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full items-center justify-center px-4 py-2 select-none bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Card className="p-6 space-y-5">
          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-foreground text-xl font-semibold tracking-tight">
                Welcome back to Tethr
              </h1>
              <p className="text-muted-foreground text-xs font-normal">
                Choose your developer identity provider to access your workspace
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-2.5 text-center text-xs">
              {errorMsg}
            </div>
          )}

          {/* Developer OAuth Options */}
          <div className="space-y-2.5">
            {/* GitHub OAuth Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthSignIn("oauth_github")}
              disabled={loadingProvider !== null || !clerk.loaded}
              className="w-full justify-between h-11 px-3.5 text-xs font-medium"
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-foreground text-background flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  {loadingProvider === "oauth_github" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      />
                    </svg>
                  )}
                </div>
                <span>Continue with GitHub</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOAuthSignIn("oauth_google")}
              disabled={loadingProvider !== null || !clerk.loaded}
              className="w-full justify-between h-11 px-3.5 text-xs font-medium"
            >
              <div className="flex items-center gap-2.5">
                <div className="border border-border flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  {loadingProvider === "oauth_google" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="font-bold text-xs">G</span>
                  )}
                </div>
                <span>Continue with Google</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            <span>Passwordless OAuth 2.0 via Clerk</span>
          </div>

          <div id="clerk-captcha" />

          <div className="text-muted-foreground border-t border-border pt-2 text-center text-xs">
            New to Tethr?{" "}
            <Link href="/sign-up" className="text-primary font-medium hover:underline">
              Create account
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
