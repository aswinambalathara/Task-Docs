import Link from "next/link"
import { ArrowRight, Check, FileText, Star } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { APP_URL } from "@/lib/site"

const assistants = ["Claude Code", "Cursor", "Windsurf", "Antigravity"]

const steps = [
  {
    title: "Log the work",
    body: "Record each contribution with its outcome and evidence (PRs, commits, tickets) from the dashboard or straight from your AI coding assistant over MCP.",
  },
  {
    title: "Sync to Google Docs",
    body: "Tethr writes a clean daily contribution table into a Google Doc you own, in real time, at end of day, or weekly.",
  },
  {
    title: "Walk into reviews ready",
    body: "Weekly rollups and month-end appraisal summaries turn months of work into a record you can paste into a review or promotion packet.",
  },
]

const features = [
  {
    title: "IDE-native logging",
    body: "Works with Claude Code, Cursor, Windsurf and Antigravity through the Model Context Protocol.",
  },
  {
    title: "Scheduled summaries",
    body: "Saturday weekly summaries and month-end dossiers, generated automatically.",
  },
  {
    title: "Career highlights",
    body: "Star your biggest wins to build a ready-made brag sheet.",
  },
  {
    title: "Private by design",
    body: "Each workspace is isolated, and Google tokens are encrypted at rest.",
  },
]

// Sample rows for the ledger preview. Columns mirror the real Google Doc table.
const ledgerRows = [
  {
    date: "Oct 13",
    contribution: "Cut checkout p95 latency",
    status: "Done",
    statusClass: "text-status-done",
    outcome: "p95 dropped from 820ms to 310ms",
    evidence: "PR #482",
    starred: true,
  },
  {
    date: "Oct 13",
    contribution: "Migrate auth to production",
    status: "In progress",
    statusClass: "text-status-progress",
    outcome: "DNS verified, SSO next",
    evidence: "feat/clerk-prod",
    starred: false,
  },
  {
    date: "Oct 12",
    contribution: "Fix flaky webhook tests",
    status: "Done",
    statusClass: "text-status-done",
    outcome: "CI pass rate 91% to 100%",
    evidence: "a41f9c2",
    starred: false,
  },
  {
    date: "Oct 11",
    contribution: "Redis failover on-call",
    status: "Done",
    statusClass: "text-status-done",
    outcome: "Restored in 12 min, no data loss",
    evidence: "INC-2041",
    starred: true,
  },
]

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Glow behind the preview */}
      <div
        aria-hidden
        className="bg-primary/25 absolute -inset-x-8 top-8 -bottom-8 -z-10 rounded-full blur-3xl"
      />

      {/* The Google Doc ledger */}
      <div className="bg-card/90 border-border overflow-hidden rounded-xl border shadow-2xl shadow-black/20 backdrop-blur">
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <FileText className="h-4 w-4 text-[#4285f4]" />
          <span className="text-foreground text-xs font-medium">
            Engineering Contributions 2026
          </span>
          <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="bg-status-done h-1.5 w-1.5 animate-pulse rounded-full" />
            Synced just now
          </span>
        </div>
        <div className="px-4 pt-4 pb-5 sm:px-6">
          <p className="text-foreground text-sm font-semibold">Week of October 11</p>
          <table className="mt-3 w-full text-left text-[11px] sm:text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-border border-b">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Contribution</th>
                <th className="hidden py-2 pr-3 font-medium sm:table-cell">Status</th>
                <th className="py-2 pr-3 font-medium">Outcome</th>
                <th className="hidden py-2 font-medium md:table-cell">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.map((row) => (
                <tr key={row.contribution} className="border-border/60 border-b last:border-0">
                  <td className="text-muted-foreground py-2.5 pr-3 align-top whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="text-foreground py-2.5 pr-3 align-top font-medium">
                    <span className="inline-flex items-start gap-1">
                      {row.contribution}
                      {row.starred && (
                        <Star className="fill-highlight text-highlight mt-0.5 h-3 w-3 shrink-0" />
                      )}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "hidden py-2.5 pr-3 align-top whitespace-nowrap sm:table-cell",
                      row.statusClass
                    )}
                  >
                    {row.status}
                  </td>
                  <td className="text-muted-foreground py-2.5 pr-3 align-top">{row.outcome}</td>
                  <td className="text-primary hidden py-2.5 align-top font-mono whitespace-nowrap md:table-cell">
                    {row.evidence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The MCP call that produced the top row */}
      <div className="relative z-10 -mt-6 ml-auto w-[88%] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 font-mono text-[11px] leading-relaxed text-zinc-400 shadow-2xl shadow-black/40 sm:-mt-10 sm:w-[70%] sm:text-xs">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="ml-2 text-[10px] text-zinc-500">claude code</span>
        </div>
        <pre className="overflow-x-auto px-4 py-3">
          <span className="text-violet-400">tethr</span>
          <span className="text-zinc-600"> · </span>
          <span className="text-zinc-200">add_task</span>
          {"\n"}
          {"{\n"}
          {"  "}
          <span className="text-sky-300">&quot;outcome&quot;</span>
          {": "}
          <span className="text-emerald-300">&quot;p95 dropped from 820ms to 310ms&quot;</span>
          {",\n  "}
          <span className="text-sky-300">&quot;evidence&quot;</span>
          {": "}
          <span className="text-emerald-300">&quot;PR #482&quot;</span>
          {"\n}\n"}
          <span className="text-emerald-400">✓ Logged and synced to your Google Doc</span>
        </pre>
      </div>
    </div>
  )
}

// Public homepage for signed-out visitors. Server-rendered so Google's OAuth verification can read it.
export function LandingPage() {
  return (
    <div className="w-full overflow-x-clip">
      {/* Hero */}
      <section className="container mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:pt-24 lg:pb-28">
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-7 duration-700">
          <div className="border-border bg-card/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur">
            <span className="bg-primary h-1.5 w-1.5 rounded-full" />
            Logs straight from your AI coding assistant over MCP
          </div>
          <h1 className="text-foreground text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
            Your engineering work,{" "}
            <span className="bg-linear-to-r from-violet-500 via-fuchsia-500 to-violet-400 bg-clip-text text-transparent">
              on the record.
            </span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed sm:text-lg">
            Tethr is a contribution ledger for software engineers. Log what you shipped, the outcome
            it delivered and the evidence behind it, and Tethr keeps an up-to-date record in your
            own Google Doc, ready for performance reviews.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={`${APP_URL}/sign-up`}
              className={cn(buttonVariants({ size: "lg" }), "shadow-primary/30 shadow-lg")}
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={`${APP_URL}/sign-in`}
              className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
            >
              Sign in
            </a>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs">
            <span className="text-foreground/70 font-medium">Works with</span>
            {assistants.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <ProductPreview />
        </div>
      </section>

      {/* The contribution spine */}
      <section className="border-border bg-card/30 border-y backdrop-blur-sm">
        <div className="container mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:flex-row sm:justify-center sm:gap-6 sm:px-6">
          {["Contribution", "Outcome", "Evidence"].map((word, idx) => (
            <div key={word} className="flex items-center gap-3 sm:gap-6">
              {idx > 0 && (
                <ArrowRight className="text-primary hidden h-5 w-5 sm:block" aria-hidden />
              )}
              <span className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                {word}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground -mt-6 pb-10 text-center text-sm">
          One row per piece of work. Every claim backed by a PR, a commit or a ticket.
        </p>
      </section>

      {/* How it works */}
      <section className="container mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl space-y-3">
          <p className="text-primary text-sm font-medium">How it works</p>
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Log as you go. Show up to reviews with receipts.
          </h2>
        </div>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
          {steps.map(({ title, body }, idx) => (
            <li
              key={title}
              className="border-border space-y-3 border-t pt-6 md:border-t-0 md:border-l md:px-8 md:pt-0 md:first:border-l-0 md:first:pl-0"
            >
              <span className="text-primary/80 font-mono text-sm">0{idx + 1}</span>
              <h3 className="text-foreground text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="container mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
        <dl className="border-border grid border-t sm:grid-cols-2">
          {features.map(({ title, body }) => (
            <div
              key={title}
              className="border-border flex gap-4 border-b py-7 sm:odd:pr-10 sm:even:border-l sm:even:pl-10"
            >
              <Check className="text-primary mt-1 h-4 w-4 shrink-0" aria-hidden />
              <div className="space-y-1">
                <dt className="text-foreground font-semibold">{title}</dt>
                <dd className="text-muted-foreground text-sm leading-relaxed">{body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Google data disclosure */}
      <section id="google-data" className="container mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">
            How Tethr uses your Google account
          </h2>
          <div className="border-primary/60 space-y-4 border-l-2 pl-6">
            <p className="text-muted-foreground leading-relaxed">
              Connecting Google Docs is optional. If you connect it, Tethr asks for permission to
              create and edit Google Docs, and to access only the Drive files that Tethr creates or
              that you open with it. Tethr uses this access to create your ledger document and write
              your logged tasks and summaries into it. It does not read your other documents, does
              not sell your data, and does not use your Google data to train AI models. You can
              disconnect at any time from Settings.
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
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="bg-primary/20 absolute top-1/2 left-1/2 -z-10 h-64 w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        />
        <div className="container mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
          <h2 className="text-foreground text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Start your record today.
          </h2>
          <p className="text-muted-foreground max-w-md">
            Free to use. Your ledger lives in your own Google Drive.
          </p>
          <a
            href={`${APP_URL}/sign-up`}
            className={cn(buttonVariants({ size: "lg" }), "shadow-primary/30 shadow-lg")}
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  )
}
