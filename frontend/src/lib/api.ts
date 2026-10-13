// Authenticated fetch for the backend API (via the /api/v1 proxy route).
//
// The browser is the single source of the auth token. Clerk session tokens live 60 seconds and
// only Clerk's browser SDK can refresh them; getToken() returns a valid token, refreshing it
// first when needed. The proxy cannot do that during an API request, so it only forwards the
// header (a cookie read server-side right after a page reload could hold an expired token).

type TokenGetter = () => Promise<string | null>

// Clerk normally loads in well under a second; past this, send the request without a token
// and let the 401 surface as an error instead of hanging every request
const CLERK_LOAD_TIMEOUT_MS = 10_000

let resolveTokenGetter: (getter: TokenGetter) => void
let tokenGetterReady = new Promise<TokenGetter>((resolve) => {
  resolveTokenGetter = resolve
})

// Called by <AuthTokenBridge /> once Clerk has loaded (signed in or out)
export function registerTokenGetter(getter: TokenGetter) {
  tokenGetterReady = Promise.resolve(getter)
  resolveTokenGetter(getter)
}

async function getToken(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), CLERK_LOAD_TIMEOUT_MS)
  })
  const getter = await Promise.race([tokenGetterReady, timeout])
  clearTimeout(timer)
  if (!getter) return null
  try {
    return await getter()
  } catch {
    return null
  }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = await getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
