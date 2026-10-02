import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { User, UserManager } from "oidc-client-ts"
import { createAuthUserManager, type AuthRuntimeConfig } from "./config.js"
import { AuthContext } from "./context.js"

/** Props for AuthProvider; provide either runtime config or a shared UserManager. */
export interface AuthProviderProps {
  children: ReactNode
  config?: AuthRuntimeConfig
  userManager?: UserManager
}

interface ManagedSession {
  error: Error | null
  isLoading: boolean
  user: User | null
}

const resolveUserManager = (
  userManager: UserManager | undefined,
  config: AuthRuntimeConfig | undefined,
): UserManager => {
  if (userManager) return userManager
  if (config) return createAuthUserManager(config)
  throw new Error("AuthProvider requires config or userManager")
}

const useManagedSession = (manager: UserManager): ManagedSession => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    const acceptUser = (nextUser: User) => {
      if (active) setUser(nextUser)
    }
    const clearUser = () => {
      if (active) setUser(null)
    }

    manager.events.addUserLoaded(acceptUser)
    manager.events.addUserUnloaded(clearUser)
    manager.events.addAccessTokenExpired(clearUser)

    void manager
      .getUser()
      .then((storedUser) => {
        if (active) setUser(storedUser?.expired ? null : storedUser)
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason
              : new Error("Unable to restore the auth session"),
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      manager.events.removeUserLoaded(acceptUser)
      manager.events.removeUserUnloaded(clearUser)
      manager.events.removeAccessTokenExpired(clearUser)
    }
  }, [manager])

  return { error, isLoading, user }
}

/** Provides a shared OIDC session without forcing anonymous users to sign in. */
export function AuthProvider({
  children,
  config,
  userManager,
}: AuthProviderProps) {
  const managerRef = useRef<UserManager | null>(null)
  const manager =
    managerRef.current ??
    (managerRef.current = resolveUserManager(userManager, config))
  const { error, isLoading, user } = useManagedSession(manager)

  const value = useMemo(
    () => ({ error, isLoading, user, userManager: manager }),
    [error, isLoading, manager, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
