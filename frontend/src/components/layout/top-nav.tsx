"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { FileText, Layers, Settings, Menu, X, LogOut, LogIn } from "lucide-react"
import { useUser, useClerk, UserButton } from "@clerk/nextjs"

import { ThemeToggle } from "@/components/theme-toggle"
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

  const { isLoaded, isSignedIn, user: clerkUser } = useUser()
  const { signOut } = useClerk()

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Layers },
    { href: "/settings", label: "MCP & Docs Config", icon: Settings },
  ]

  const handleSignOut = async () => {
    await signOut()
    if (typeof window !== "undefined") {
      localStorage.removeItem("tethr-auth-storage")
    }
    router.push("/sign-in")
  }

  // Active Clerk auth state
  const authed = mounted && isLoaded ? Boolean(isSignedIn) : false
  const currentUser =
    authed && clerkUser
      ? {
          id: clerkUser.id,
          name:
            clerkUser.fullName ||
            clerkUser.username ||
            clerkUser.primaryEmailAddress?.emailAddress?.split("@")[0] ||
            "Developer",
          email: clerkUser.primaryEmailAddress?.emailAddress || "",
          avatar: clerkUser.imageUrl,
        }
      : null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="text-muted-foreground hover:text-foreground hover:bg-muted border border-border shrink-0 rounded-md p-1.5 transition-colors lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo & Brand */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex shrink-0 flex-col">
              <span className="text-foreground text-sm font-semibold tracking-tight whitespace-nowrap">
                Tethr
              </span>
              <span className="text-muted-foreground hidden truncate text-xs font-normal md:inline">
                Dev Tracker & Docs Sync
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {authed && (
            <nav className="hidden shrink-0 items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary-soft text-primary-soft-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
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
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden flex-col text-right leading-tight sm:flex">
                <span className="text-foreground max-w-28 truncate text-xs font-medium">
                  {currentUser.name}
                </span>
                <span className="text-muted-foreground max-w-28 truncate text-[11px]">
                  {currentUser.email}
                </span>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 rounded-full border border-border",
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/sign-in">
                <Button size="sm">
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
            transition={{ duration: 0.15 }}
            className="border-b border-border bg-card space-y-3 overflow-hidden px-4 py-3 lg:hidden"
          >
            {authed ? (
              <>
                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-primary-soft text-primary-soft-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Mobile Footer with User info & Sign out */}
                <div className="border-t border-border text-muted-foreground flex items-center justify-between pt-2 text-xs">
                  <span className="text-foreground font-medium">{currentUser?.name}</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-destructive flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    <LogOut className="h-3.5 w-3.5" />
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
                  className="block w-full"
                >
                  <Button className="w-full" size="sm">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
