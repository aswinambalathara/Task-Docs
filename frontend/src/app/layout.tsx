import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { TopNav } from "@/components/layout/top-nav"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Tethr | Modern Dev Task Tracker & Google Docs MCP Sync",
  description:
    "Seamless engineering task manager synced in real-time with Google Docs via Anthropic Model Context Protocol (MCP).",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} min-h-full font-sans antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground selection:bg-moody-blue-500/30 selection:text-moody-blue-200 relative flex min-h-screen flex-col antialiased">
        {/* Fixed Ambient Background System (Immune to scroll cutoff, split lines, or GPU tile clipping) */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="mesh-gradient-bg absolute inset-0" />
          <div className="bg-moody-blue-500/12 dark:bg-moody-blue-500/20 absolute -top-24 left-1/4 h-120 w-120 rounded-full blur-3xl" />
          <div className="bg-moody-blue-700/10 dark:bg-moody-blue-700/18 absolute top-1/3 -right-20 h-104 w-104 rounded-full blur-3xl" />
          <div className="bg-moody-blue-600/8 dark:bg-moody-blue-600/15 absolute -bottom-24 left-1/3 h-112 w-md rounded-full blur-3xl" />
        </div>

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopNav />
          <main className="flex-1 pb-16">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
