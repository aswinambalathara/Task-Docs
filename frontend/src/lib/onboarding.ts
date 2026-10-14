"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"

// Onboarding completion lives on the Clerk user (unsafeMetadata is writable from the browser),
// so it follows the user across devices without a backend users collection.
const COMPLETED_KEY = "onboardingCompletedAt"

export function useOnboardingStatus() {
  const { isLoaded, isSignedIn, user } = useUser()

  const completedAt = user?.unsafeMetadata?.[COMPLETED_KEY]
  const isCompleted = typeof completedAt === "string" && completedAt.length > 0

  const markCompleted = React.useCallback(async () => {
    if (!user) return
    await user.update({
      unsafeMetadata: { ...user.unsafeMetadata, [COMPLETED_KEY]: new Date().toISOString() },
    })
  }, [user])

  return { isLoaded, isSignedIn: !!isSignedIn, isCompleted, markCompleted }
}
