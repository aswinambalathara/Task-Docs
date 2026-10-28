import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

import { PageLoader } from "@/components/layout/page-loader"

export default function SSOCallback() {
  return (
    <>
      {/* The callback renders nothing, so show the loader while it redirects */}
      <PageLoader />
      <AuthenticateWithRedirectCallback />
    </>
  )
}
