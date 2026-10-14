import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { DashboardPage } from "@/components/dashboard/dashboard-page"

// The app's root: the dashboard for signed-in users, sign-in for everyone else.
// The public homepage lives on the site host (see proxy.ts) and at /home.
export default async function AppRootPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  return <DashboardPage />
}
