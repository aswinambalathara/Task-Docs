import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"
import { clerkMiddleware } from "@clerk/nextjs/server"

import { APP_URL, SITE_HOST } from "@/lib/site"

const clerk = clerkMiddleware()

// Pages the public site serves; any other path on that host belongs to the app
const SITE_PATHS = new Set(["/", "/privacy", "/terms"])

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.headers.get("host") === SITE_HOST) {
    const { pathname, search } = req.nextUrl
    if (!SITE_PATHS.has(pathname)) {
      return NextResponse.redirect(new URL(pathname + search, APP_URL))
    }
    // The site's homepage is the landing page; the app's "/" is the dashboard
    if (pathname === "/") return NextResponse.rewrite(new URL("/home", req.url))
    return NextResponse.next()
  }

  return clerk(req, event)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
