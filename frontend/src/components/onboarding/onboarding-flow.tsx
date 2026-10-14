"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"

import { TethrLogo } from "@/components/brand/tethr-logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOnboardingStatus } from "@/lib/onboarding"
import { cn } from "@/lib/utils"

import { SetupChecklist } from "./setup-checklist"
import { ONBOARDING_STEPS } from "./steps"

// Text slides in from the side you're heading towards
const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 40 }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -40,
    transition: { duration: 0.2, ease: "easeIn" },
  }),
}

const rise: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
}

export function OnboardingFlow() {
  const router = useRouter()
  const { markCompleted } = useOnboardingStatus()
  const [[index, direction], setPage] = React.useState<[number, number]>([0, 0])
  const [isFinishing, setIsFinishing] = React.useState(false)

  const step = ONBOARDING_STEPS[index]
  const isFirst = index === 0
  const isLast = index === ONBOARDING_STEPS.length - 1
  const Illustration = step.illustration

  const goTo = React.useCallback(
    (next: number) => {
      if (next < 0 || next >= ONBOARDING_STEPS.length || next === index) return
      setPage([next, next > index ? 1 : -1])
    },
    [index]
  )

  const finish = React.useCallback(
    async (href: string = "/") => {
      if (isFinishing) return
      setIsFinishing(true)
      try {
        await markCompleted()
      } catch {
        // Not being able to save the flag only means the tour may show again
      }
      router.push(href)
    },
    [isFinishing, markCompleted, router]
  )

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))
        return
      if (event.key === "ArrowRight") goTo(index + 1)
      else if (event.key === "ArrowLeft") goTo(index - 1)
      else if (event.key === "Escape") finish()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goTo, finish, index])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-4xl"
        >
          <Card className="gap-0 py-0 shadow-xl">
            {/* Header */}
            <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3 sm:px-6">
              <div className="flex items-center gap-2.5">
                <TethrLogo className="h-7 w-7" />
                <span className="text-muted-foreground text-xs font-medium">
                  Step {index + 1} of {ONBOARDING_STEPS.length}
                </span>
              </div>
              {!isLast && (
                <Button variant="ghost" size="sm" onClick={() => finish()} disabled={isFinishing}>
                  Skip tour
                </Button>
              )}
            </div>

            {/* Body */}
            <div className="grid md:grid-cols-2">
              <div className="bg-muted/40 border-border relative flex min-h-56 items-center justify-center overflow-hidden border-b p-6 sm:min-h-72 md:border-r md:border-b-0 md:p-8">
                <div
                  aria-hidden="true"
                  className="bg-primary/10 absolute -top-16 -left-16 h-48 w-48 rounded-full blur-3xl"
                />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="relative flex w-full justify-center"
                  >
                    <Illustration />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="relative flex min-h-80 flex-col overflow-hidden p-6 sm:p-8">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={step.id}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="flex flex-1 flex-col"
                  >
                    <motion.span
                      variants={rise}
                      className="text-primary text-xs font-semibold tracking-wider uppercase"
                    >
                      {step.eyebrow}
                    </motion.span>
                    <motion.h1
                      variants={rise}
                      className="text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-[1.65rem]"
                    >
                      {step.title}
                    </motion.h1>
                    <motion.p
                      variants={rise}
                      className="text-muted-foreground mt-3 text-sm leading-relaxed"
                    >
                      {step.description}
                    </motion.p>

                    {step.points.length > 0 && (
                      <ul className="mt-5 space-y-2.5">
                        {step.points.map((point) => (
                          <motion.li
                            key={point}
                            variants={rise}
                            className="flex items-start gap-2.5 text-sm"
                          >
                            <span className="bg-primary-soft text-primary-soft-foreground mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            <span className="text-foreground/90">{point}</span>
                          </motion.li>
                        ))}
                      </ul>
                    )}

                    {isLast && (
                      <motion.div variants={rise} className="mt-5">
                        <SetupChecklist onNavigate={finish} />
                      </motion.div>
                    )}

                    {step.action && (
                      <motion.div variants={rise} className="mt-5">
                        <Button
                          variant="link"
                          className="h-auto px-0"
                          onClick={() => finish(step.action?.href)}
                          disabled={isFinishing}
                        >
                          {step.action.label} now
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Footer */}
            <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-6">
              <div
                className="flex items-center gap-1.5"
                role="tablist"
                aria-label="Onboarding steps"
              >
                {ONBOARDING_STEPS.map((item, dotIndex) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={dotIndex === index}
                    aria-label={`Step ${dotIndex + 1}: ${item.eyebrow}`}
                    onClick={() => goTo(dotIndex)}
                    animate={{ width: dotIndex === index ? 24 : 8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={cn(
                      "relative h-2 cursor-pointer overflow-hidden rounded-full transition-colors",
                      dotIndex < index
                        ? "bg-primary/40"
                        : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                    )}
                  >
                    {dotIndex === index && (
                      <motion.span
                        layoutId="onboarding-active-dot"
                        className="bg-primary absolute inset-0 rounded-full"
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goTo(index - 1)}
                    disabled={isFinishing}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </Button>
                )}
                {isLast ? (
                  <Button size="sm" onClick={() => finish()} disabled={isFinishing}>
                    {isFinishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Go to dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => goTo(index + 1)}>
                    {isFirst ? "Get started" : "Next"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </MotionConfig>
  )
}
