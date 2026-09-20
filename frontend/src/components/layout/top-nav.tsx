"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  FileText, 
  Layers, 
  Settings, 
  Menu, 
  X,
  LogOut,
  LogIn,
  ShieldCheck,
  User as UserIcon
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/button"

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  const { isAuthenticated, user, logout } = useAuthStore()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

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
    <header className="sticky top-0 z-50 w-full glass-nav transition-all">
      <div className="container mx-auto max-w-7xl h-16 flex items-center justify-between px-3 sm:px-6 lg:px-8">
        
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-2 sm:gap-8 min-w-0">
          
          {/* Mobile/Tablet Menu Toggle Button (shown only when authenticated or mobile) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-colors shrink-0 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-moody-blue-600 to-moody-blue-800 text-white shadow-md shadow-moody-blue-600/25 group-hover:scale-105 transition-transform shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              {authed && (
                <div className="absolute -bottom-1 -right-1 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex flex-col shrink-0">
              <span className="font-bold text-base tracking-tight text-foreground group-hover:text-moody-blue-600 dark:group-hover:text-moody-blue-400 transition-colors whitespace-nowrap">
                TaskDocs
              </span>
              <span className="text-xs font-normal text-muted-foreground hidden md:inline truncate">
                Dev Tracker & Docs Sync
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links (shown when authenticated) */}
          {authed && (
            <nav className="hidden lg:flex items-center p-1 rounded-xl bg-muted/40 dark:bg-muted/20 border border-border/50 backdrop-blur-md gap-0.5 shrink-0">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium tracking-tight transition-colors duration-150 cursor-pointer select-none shrink-0 ${
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-moody-blue-600 dark:text-moody-blue-400" : "text-muted-foreground/70"}`} />
                    <span>{link.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeNavTab"
                        className="absolute inset-0 rounded-lg bg-background dark:bg-card shadow-xs border border-border/70 dark:border-border/60 -z-10"
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
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth State Control */}
          {authed && currentUser ? (
            <div className="flex items-center gap-2 shrink-0">
              {/* User Profile Pill */}
              <div
                className="flex items-center gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 rounded-full bg-muted/60 dark:bg-muted/30 text-xs font-medium border border-border/80 transition-colors shrink-0 shadow-xs"
                title={`${currentUser.name} (${currentUser.provider})`}
              >
                <div className="w-6 h-6 rounded-full bg-linear-to-tr from-moody-blue-600 to-moody-blue-400 text-white flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                  {currentUser.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="text-foreground font-medium text-xs truncate max-w-25">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
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
                className="h-8 px-2.5 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 text-xs gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button 
                  size="sm"
                  className="rounded-xl h-9 px-4 bg-linear-to-r from-moody-blue-600 to-moody-blue-700 hover:from-moody-blue-700 hover:to-moody-blue-800 text-white font-medium text-xs shadow-md shadow-moody-blue-600/20 gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
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
            className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-4 py-3 space-y-3 shadow-xl overflow-hidden"
          >
            {authed ? (
              <>
                <div className="flex flex-col gap-1 p-1 rounded-2xl bg-muted/30 border border-border/40">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? "bg-background text-foreground font-semibold shadow-xs border border-border/80"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-moody-blue-600 dark:text-moody-blue-400" : "text-muted-foreground"}`} />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Mobile Footer with User info & Sign out */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-moody-blue-600 text-white flex items-center justify-center font-semibold text-[10px]">
                      {currentUser?.name.charAt(0)}
                    </div>
                    <span className="font-medium text-foreground">{currentUser?.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs text-destructive hover:underline font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Sign in to access your developer workspace & tasks.</p>
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-2 rounded-xl bg-moody-blue-600 text-white text-xs font-semibold text-center"
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


