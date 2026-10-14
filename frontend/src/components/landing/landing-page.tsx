import Link from "next/link"
import {
  ArrowRight,
  Bot,
  CalendarClock,
  FileText,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"

import { TethrLogo } from "@/components/brand/tethr-logo"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { APP_URL } from "@/lib/site"

const steps = [
  {
    icon: ListChecks,
    title: "Log the work",
    body: "Record each contribution with its outcome and evidence (PRs, commits, tickets) from the dashboard or straight from your AI coding assistant over MCP.",
  },
  {
    icon: FileText,
    title: "Sync to Google Docs",
    body: "Tethr writes a clean daily contribution table into a Google Doc you own, in real time, at end of day, or weekly.",
  },
  {
    icon: Sparkles,
    title: "Walk into reviews ready",
    body: "Weekly rollups and month-end appraisal summaries turn months of work into a record you can paste into a review or promotion packet.",
  },
]

const features = [
  {
    icon: Bot,
    title: "IDE-native logging",
    body: "Works with Claude Code, Cursor, Windsurf and Antigravity through the Model Context Protocol.",
  },
  {
    icon: CalendarClock,
    title: "Scheduled summaries",
    body: "Saturday weekly summaries and month-end dossiers, generated automatically.",
  },
  {
    icon: Star,
    title: "Career highlights",
    body: "Star your biggest wins to build a ready-made brag sheet.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Each workspace is isolated, and Google tokens are encrypted at rest.",
  },
]

// Public homepage for signed-out visitors. Server-rendered so Google's OAuth verification can read it.
export function LandingPage() {
  return (
    <div className="container mx-auto w-full max-w-5xl space-y-16 px-4 py-12 sm:px-6 sm:py-20">
      {/* Hero */}
      <section className="flex flex-col items-center space-y-6 text-center">
        <TethrLogo className="h-14 w-14" />
        <div className="space-y-3">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-5xl">
            Your engineering work, on the record.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
            Tethr is a contribution ledger for software engineers. Log what you shipped, the outcome
            it delivered and the evidence behind it, and Tethr keeps an up-to-date record in your
            own Google Doc, ready for performance reviews.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`${APP_URL}/sign-up`} className={cn(buttonVariants({ size: "lg" }))}>
            Get started free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={`${APP_URL}/sign-in`}
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            Sign in
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-foreground text-center text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, idx) => (
            <div key={title} className="bg-card border-border space-y-3 rounded-lg border p-5">
              <div className="flex items-center gap-2">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-8 w-8 items-center justify-center rounded-md">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-muted-foreground text-xs font-medium">Step {idx + 1}</span>
              </div>
              <h3 className="text-foreground text-sm font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-card border-border flex gap-3 rounded-lg border p-5">
            <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-foreground text-sm font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Google data disclosure */}
      <section
        id="google-data"
        className="bg-card border-border space-y-3 rounded-lg border p-6 sm:p-8"
      >
        <div className="flex items-center gap-2">
          <FileText className="text-primary h-5 w-5" />
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            How Tethr uses your Google account
          </h2>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Connecting Google Docs is optional. If you connect it, Tethr asks for permission to create
          and edit Google Docs, and to access only the Drive files that Tethr creates or that you
          open with it. Tethr uses this access to create your ledger document and write your logged
          tasks and summaries into it. It does not read your other documents, does not sell your
          data, and does not use your Google data to train AI models. You can disconnect at any time
          from Settings.
        </p>
        <p className="text-muted-foreground text-sm">
          Read the full details in our{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
