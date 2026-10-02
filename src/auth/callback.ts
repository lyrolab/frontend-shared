import type { User, UserManager } from "oidc-client-ts"

/** Options for completing an OIDC callback from a TanStack route. */
export interface AuthCallbackOptions {
  fallbackPath?: string
  navigate?: (path: string) => void
}

interface CallbackState {
  returnTo?: unknown
}

const safeReturnTo = (state: unknown, fallbackPath: string): string => {
  const returnTo = (state as CallbackState | undefined)?.returnTo

  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
  ) {
    return returnTo
  }

  return fallbackPath
}

/** Creates a route callback that completes OIDC and safely restores a local path. */
export function createAuthCallbackHandler(
  userManager: UserManager,
  {
    fallbackPath = "/",
    navigate = (path) => window.location.replace(path),
  }: AuthCallbackOptions = {},
): () => Promise<User> {
  return async () => {
    const user = await userManager.signinRedirectCallback()
    navigate(safeReturnTo(user.state, fallbackPath))
    return user
  }
}
