import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
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
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} min-h-full font-sans antialiased`}
        data-scroll-behavior="smooth"
        suppressHydrationWarning
      >
        <body className="bg-background text-foreground selection:bg-primary-soft selection:text-primary-soft-foreground relative flex min-h-screen flex-col antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TopNav />
            <main className="flex flex-1 flex-col">{children}</main>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
