import { User, type UserManager } from "oidc-client-ts"
import { readAccountActionState } from "./account-state.js"

/** Action feedback, never proof that an account security setting is enabled. */
export type AccountActionStatus = "success" | "cancelled" | "error"

/** Optional feedback for a validated, stored AIA transaction. */
export interface AuthCallbackNavigation {
  accountActionStatus?: AccountActionStatus
}

/** Options for completing an OIDC callback from a TanStack route. */
export interface AuthCallbackOptions {
  fallbackPath?: string
  navigate?: (path: string, result?: AuthCallbackNavigation) => void
}

interface CallbackState {
  returnTo?: unknown
}

const isLocalPath = (path: unknown): path is string =>
  typeof path === "string" &&
  path.startsWith("/") &&
  !path.startsWith("//") &&
  // eslint-disable-next-line no-control-regex -- Reject characters browsers strip when parsing redirect URLs.
  !/[\\\s\u0000-\u001f\u007f]/u.test(path)

const safeReturnTo = (state: unknown, fallbackPath: string): string => {
  const returnTo = (state as CallbackState | undefined)?.returnTo

  if (isLocalPath(returnTo)) {
    return returnTo
  }

  return fallbackPath
}

const actionStatus = (
  url: string,
  responseMode: "query" | "fragment",
  kcAction: string,
): AccountActionStatus | undefined => {
  const callbackUrl = new URL(url)
  const params = new URLSearchParams(
    responseMode === "fragment"
      ? callbackUrl.hash.slice(1)
      : callbackUrl.search,
  )
  const statuses = params.getAll("kc_action_status")
  const actions = params.getAll("kc_action")

  if (
    statuses.length !== 1 ||
    actions.length > 1 ||
    (actions.length === 1 && actions[0] !== kcAction)
  ) {
    return undefined
  }
  const status = statuses[0]
  return status === "success" || status === "cancelled" || status === "error"
    ? status
    : undefined
}

/** Creates a route callback that completes OIDC and safely restores a local path. */
export function createAuthCallbackHandler(
  userManager: UserManager,
  {
    fallbackPath = "/",
    navigate = (path) => window.location.replace(path),
  }: AuthCallbackOptions = {},
): (url?: string) => Promise<User> {
  if (!isLocalPath(fallbackPath)) {
    throw new Error("Auth callback fallbackPath must be a local path")
  }

  return async (url = window.location.href) => {
    // Validate the same captured URL before interpreting provider-specific feedback.
    const validatedUser = await userManager.signinRedirectCallback(url)
    const action = readAccountActionState(validatedUser.state)
    const user = action
      ? new User({ ...validatedUser, userState: action.state })
      : validatedUser
    const path = safeReturnTo(user.state, fallbackPath)
    const status = action
      ? actionStatus(
          url,
          userManager.settings.response_mode ??
            (userManager.settings.response_type.includes("code")
              ? "query"
              : "fragment"),
          action.kcAction,
        )
      : undefined

    if (status) {
      navigate(path, { accountActionStatus: status })
    } else {
      navigate(path)
    }
    return user
  }
}
