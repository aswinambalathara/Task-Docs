import { APP_URL } from "@/lib/site"

// Resolves a redirect_url param against `base`, falling back to "/" unless it stays on this app,
// so the param can't be used as an open redirect
export function safeRedirectUrl(target: string | null, base: string): URL {
  const fallback = new URL("/", base)
  try {
    const url = new URL(target ?? "/", base)
    const allowed = [new URL(base).origin, new URL(APP_URL).origin]
    return allowed.includes(url.origin) ? url : fallback
  } catch {
    return fallback
  }
}

// Carries a redirect_url param over to another auth page
export function withRedirect(path: string, target: string | null): string {
  return target ? `${path}?redirect_url=${encodeURIComponent(target)}` : path
}
