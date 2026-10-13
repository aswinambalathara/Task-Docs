"use client"

import * as React from "react"
import { useAuth } from "@clerk/nextjs"

import { registerTokenGetter } from "@/lib/api"

// Connects authFetch (used by the zustand stores, which live outside React) to Clerk.
// Requests made before this runs wait for it, so effect order does not matter.
export function AuthTokenBridge() {
  const { getToken, isLoaded } = useAuth()

  React.useEffect(() => {
    if (isLoaded) registerTokenGetter(() => getToken())
  }, [getToken, isLoaded])

  return null
}
