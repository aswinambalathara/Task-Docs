"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Layers, Settings, Menu, X, LogOut, LogIn } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/button"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const { isAuthenticated, user, logout } = useAuthStore()

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Layers },
    { href: "/settings", label: "MCP & Docs Config", icon: Settings },
  ]

  const handleSignOut = () => {
    logout()
    router.push("/sign-in")
  }

  // Avoid SSR hydration mismatch
  const authed = mounted ? isAuthenticated : false
  const currentUser = mounted ? user : null

  return (
    <header className="glass-nav sticky top-0 z-50 w-full transition-all">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-8">
          {/* Mobile/Tablet Menu Toggle Button (shown only when authenticated or mobile) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/60 shrink-0 cursor-pointer rounded-xl border p-2 transition-colors lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo & Brand */}
          <Link href="/" className="group flex shrink-0 items-center gap-2 sm:gap-2.5">
            <div className="from-moody-blue-600 to-moody-blue-800 shadow-moody-blue-600/25 relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md transition-transform group-hover:scale-105 sm:h-9 sm:w-9">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              {authed && (
                <div className="border-background absolute -right-1 -bottom-1 flex h-3 w-3 items-center justify-center rounded-full border-2 bg-emerald-500 sm:h-3.5 sm:w-3.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col">
              <span className="text-foreground group-hover:text-moody-blue-600 dark:group-hover:text-moody-blue-400 text-base font-bold tracking-tight whitespace-nowrap transition-colors">
                Tethr
              </span>
              <span className="text-muted-foreground hidden truncate text-xs font-normal md:inline">
                Dev Tracker & Docs Sync
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (shown when authenticated) */}
          {authed && (
            <nav className="bg-muted/40 dark:bg-muted/20 border-border/50 hidden shrink-0 items-center gap-0.5 rounded-xl border p-1 backdrop-blur-md lg:flex">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium tracking-tight transition-colors duration-150 select-none ${
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 transition-colors ${isActive ? "text-moody-blue-600 dark:text-moody-blue-400" : "text-muted-foreground/70"}`}
                    />
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeNavTab"
                        className="bg-background dark:bg-card border-border/70 dark:border-border/60 absolute inset-0 -z-10 rounded-lg border shadow-xs"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth State Control */}
          {authed && currentUser ? (
            <div className="flex shrink-0 items-center gap-2">
              {/* User Profile Pill */}
              <div
                className="bg-muted/60 dark:bg-muted/30 border-border/80 flex shrink-0 items-center gap-2 rounded-full border py-1 pr-2.5 pl-1.5 text-xs font-medium shadow-xs transition-colors sm:pr-3 sm:pl-2"
                title={`${currentUser.name} (${currentUser.provider})`}
              >
                <div className="from-moody-blue-600 to-moody-blue-400 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-tr text-xs font-semibold text-white">
                  {currentUser.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <div className="hidden flex-col text-left leading-tight sm:flex">
                  <span className="text-foreground max-w-25 truncate text-xs font-medium">
                    {currentUser.name}
                  </span>
                  <span className="text-muted-foreground text-[10px] capitalize">
                    {currentUser.provider}
                  </span>
                </div>
              </div>

              {/* Sign Out Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                title="Sign out of workspace"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 h-8 cursor-pointer gap-1.5 rounded-xl border border-transparent px-2.5 text-xs transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button
                  size="sm"
                  className="from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 shadow-moody-blue-600/20 h-9 cursor-pointer gap-1.5 rounded-xl bg-linear-to-r px-4 text-xs font-medium text-white shadow-md"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-border/50 bg-background/95 space-y-3 overflow-hidden border-t px-4 py-3 shadow-xl backdrop-blur-xl lg:hidden"
          >
            {authed ? (
              <>
                <div className="bg-muted/30 border-border/40 flex flex-col gap-1 rounded-2xl border p-1">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-background text-foreground border-border/80 border font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${isActive ? "text-moody-blue-600 dark:text-moody-blue-400" : "text-muted-foreground"}`}
                        />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Mobile Footer with User info & Sign out */}
                <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t px-1 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="bg-moody-blue-600 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white">
                      {currentUser?.name.charAt(0)}
                    </div>
                    <span className="text-foreground font-medium">{currentUser?.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-destructive flex cursor-pointer items-center gap-1 text-xs font-medium hover:underline"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 p-3 text-center">
                <p className="text-muted-foreground text-xs">
                  Sign in to access your developer workspace & tasks.
                </p>
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-moody-blue-600 block w-full rounded-xl py-2 text-center text-xs font-semibold text-white"
                >
                  Sign In with GitHub / Google
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
