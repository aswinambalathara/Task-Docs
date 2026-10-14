import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { LEGAL_LAST_UPDATED } from "@/lib/site"

// Shared shell for the privacy policy and terms of service
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-xs transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Tethr
      </Link>

      <article className="bg-card border-border rounded-lg border p-6 sm:p-10">
        <header className="border-border mb-8 space-y-2 border-b pb-6">
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-muted-foreground text-xs">Last updated: {LEGAL_LAST_UPDATED}</p>
          <div className="text-muted-foreground pt-2 text-sm leading-relaxed">{intro}</div>
        </header>

        <div className="text-muted-foreground [&_a]:text-primary [&_strong]:text-foreground space-y-8 text-sm leading-relaxed [&_a]:underline-offset-4 [&_a:hover]:underline [&_strong]:font-medium [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </div>
  )
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-foreground text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
