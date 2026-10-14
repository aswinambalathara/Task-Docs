"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { useOnboardingStatus } from "@/lib/onboarding"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useOnboardingStatus()

  React.useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in")
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="container mx-auto flex max-w-5xl items-center justify-center px-4 py-16">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    )
  }

  return <OnboardingFlow />
}
