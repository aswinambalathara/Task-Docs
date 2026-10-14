import Link from "next/link"

import { CONTACT_EMAIL } from "@/lib/site"

// Server-rendered so the legal links are in the page HTML (Google's OAuth verification looks for them)
export function SiteFooter() {
  return (
    <footer className="border-border bg-card/60 border-t">
      <div className="text-muted-foreground container mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs sm:flex-row sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} Tethr</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground transition-colors">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  )
}
