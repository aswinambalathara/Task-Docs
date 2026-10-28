"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { PageLoader } from "@/components/layout/page-loader"
import { useOnboardingStatus } from "@/lib/onboarding"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useOnboardingStatus()

  React.useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in")
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return <PageLoader />
  }

  return <OnboardingFlow />
}
