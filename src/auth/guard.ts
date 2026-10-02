import { redirect } from "@tanstack/react-router"
import type { User, UserManager } from "oidc-client-ts"

/** Options for the TanStack Router beforeLoad auth guard. */
export interface RequireAuthOptions {
  loginPath?: string
  userManager: UserManager
}

interface BeforeLoadLocation {
  href: string
}

interface BeforeLoadArgs {
  location: BeforeLoadLocation
}

const loginHref = (loginPath: string, returnTo: string): string => {
  const separator = loginPath.includes("?") ? "&" : "?"
  return `${loginPath}${separator}returnTo=${encodeURIComponent(returnTo)}`
}

/** Creates a TanStack beforeLoad guard that redirects only protected routes. */
export function requireAuth({
  userManager,
  loginPath = "/login",
}: RequireAuthOptions): (args: BeforeLoadArgs) => Promise<{ user: User }> {
  return async ({ location }) => {
    const user = await userManager.getUser()

    if (!user || user.expired) {
      throw redirect({ href: loginHref(loginPath, location.href) })
    }

    return { user }
  }
}
