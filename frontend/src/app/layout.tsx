import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TopNav } from "@/components/layout/top-nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskDocs | Modern Dev Task Tracker & Google Docs MCP Sync",
  description: "Seamless engineering task manager synced in real-time with Google Docs via Anthropic Model Context Protocol (MCP).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} font-sans min-h-full antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col relative bg-background text-foreground antialiased selection:bg-moody-blue-500/30 selection:text-moody-blue-200">
        {/* Fixed Ambient Background System (Immune to scroll cutoff, split lines, or GPU tile clipping) */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute inset-0 mesh-gradient-bg" />
          <div className="absolute -top-24 left-1/4 w-120 h-120 rounded-full bg-moody-blue-500/12 dark:bg-moody-blue-500/20 blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-104 h-104 rounded-full bg-moody-blue-700/10 dark:bg-moody-blue-700/18 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-md h-112 rounded-full bg-moody-blue-600/8 dark:bg-moody-blue-600/15 blur-3xl" />
        </div>

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopNav />
          <main className="flex-1 pb-16">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}

