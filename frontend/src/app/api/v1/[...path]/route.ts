import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const subPath = path ? path.join("/") : ""
    const targetUrl = new URL(`/api/v1/${subPath}`, BACKEND_URL)
    targetUrl.search = request.nextUrl.search

    // Forward request headers, filtering hop-by-hop headers
    const forwardedHeaders = new Headers()
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "host") {
        forwardedHeaders.set(key, value)
      }
    })

    // If user is signed in to Clerk, attach their live RS256 JWT session token
    try {
      const { getToken } = await auth()
      const token = await getToken()
      if (token) {
        forwardedHeaders.set("Authorization", `Bearer ${token}`)
      }
    } catch {
      // In dev mode without Clerk cookies, existing Authorization header is preserved
    }

    // Forward request body for non-GET/HEAD methods
    const hasBody = !["GET", "HEAD"].includes(request.method)
    const body = hasBody ? await request.blob() : undefined

    const backendResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: forwardedHeaders,
      body,
      redirect: "manual",
    })

    // Prepare response headers
    const responseHeaders = new Headers()
    backendResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    })

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Proxy error"
    return NextResponse.json(
      {
        detail: `Next.js API proxy failed to connect to backend: ${errorMsg}`,
      },
      { status: 502 }
    )
  }
}

export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const PATCH = handleProxy
export const DELETE = handleProxy
export const HEAD = handleProxy
export const OPTIONS = handleProxy
