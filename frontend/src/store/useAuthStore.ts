// Legacy mock auth store is fully deprecated.
// All user authentication & sessions are handled strictly by Clerk.

if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("tethr-auth-storage")
  } catch {
    // ignore
  }
}

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar: string
}
