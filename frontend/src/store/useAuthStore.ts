import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface AuthUser {
  id: string
  name: string
  email: string
  provider: "github" | "google"
  avatar: string
  role: string
  workspaceName: string
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  login: (provider: "github" | "google") => void
  logout: () => void
}

const mockUsers: Record<"github" | "google", AuthUser> = {
  github: {
    id: "usr_clerk_gh_89234",
    name: "Alex Rivera",
    email: "alex.rivera@github.dev",
    provider: "github",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    role: "Fullstack Dev",
    workspaceName: "Acme Core Eng",
  },
  google: {
    id: "usr_clerk_goog_44129",
    name: "Alex Rivera",
    email: "alex.rivera@gmail.com",
    provider: "google",
    avatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
    role: "Staff Engineer",
    workspaceName: "Sprint Docs",
  },
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: (provider) => {
        set({
          isAuthenticated: true,
          user: mockUsers[provider],
        })
      },
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
        })
      },
    }),
    {
      name: "taskdocs-auth-storage",
    }
  )
)
