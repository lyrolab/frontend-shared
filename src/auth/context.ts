import { createContext, useContext } from "react"
import type { User, UserManager } from "oidc-client-ts"

/** Current auth state exposed by AuthProvider. */
export interface AuthSession {
  error: Error | null
  isLoading: boolean
  user: User | null
  userManager: UserManager
}

export const AuthContext = createContext<AuthSession | null>(null)

/** Reads the full auth session and its UserManager. */
export function useAuth(): AuthSession {
  const auth = useContext(AuthContext)

  if (!auth) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return auth
}

/** Returns the current OIDC user, or null for an anonymous visitor. */
export function useCurrentUser(): User | null {
  return useAuth().user
}
