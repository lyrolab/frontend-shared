import type {
  SigninRedirectArgs,
  SignoutRedirectArgs,
  UserManager,
} from "oidc-client-ts"
import type { AuthRuntimeConfig } from "./config.js"
import { accountActionState } from "./account-state.js"

/** Starts the standard OIDC sign-in redirect. */
export const login = (
  userManager: UserManager,
  args?: SigninRedirectArgs,
): Promise<void> => userManager.signinRedirect(args)

/** Starts an OIDC registration redirect using the standard signup hint. */
export const register = (
  userManager: UserManager,
  args: SigninRedirectArgs = {},
): Promise<void> =>
  userManager.signinRedirect({
    ...args,
    extraQueryParams: {
      screen_hint: "signup",
      ...args.extraQueryParams,
    },
  })

/** Starts the OIDC end-session redirect. */
export const logout = (
  userManager: UserManager,
  args?: SignoutRedirectArgs,
): Promise<void> => userManager.signoutRedirect(args)

/**
 * Builds the provider account-console URL without exposing a token.
 * @deprecated Use startAccountAction(userManager, kcAction, args) for AIA.
 */
export function accountActionUrl(config: AuthRuntimeConfig): string {
  const authority = new URL(config.authority)

  if (authority.protocol !== "https:" && authority.protocol !== "http:") {
    throw new Error("Auth configuration authority must use http or https")
  }

  const url = new URL(`${authority.toString().replace(/\/$/, "")}/account/`)
  url.searchParams.set("referrer", config.clientId)
  url.searchParams.set("referrer_uri", config.redirectUri)
  return url.toString()
}

/**
 * Requests a Keycloak Application Initiated Action through the OIDC client.
 * Custom state is privately enveloped for callback correlation; use the shared callback helper.
 */
export function startAccountAction(
  userManager: UserManager,
  kcAction: string,
  args?: SigninRedirectArgs,
): Promise<void>
/**
 * Navigates to the provider account console and returns the destination URL.
 * @deprecated Use startAccountAction(userManager, kcAction, args) for AIA.
 */
export function startAccountAction(
  config: AuthRuntimeConfig,
  navigate?: (url: string) => void,
): string
export function startAccountAction(
  userManagerOrConfig: UserManager | AuthRuntimeConfig,
  actionOrNavigate?: string | ((url: string) => void),
  args: SigninRedirectArgs = {},
): Promise<void> | string {
  if ("signinRedirect" in userManagerOrConfig) {
    if (typeof actionOrNavigate !== "string" || !actionOrNavigate.trim()) {
      throw new Error("Account action requires a Keycloak action name")
    }
    return userManagerOrConfig.signinRedirect({
      ...args,
      state: accountActionState(actionOrNavigate, args.state),
      extraQueryParams: {
        ...args.extraQueryParams,
        kc_action: actionOrNavigate,
      },
    })
  }
  return startAccountConsole(userManagerOrConfig, actionOrNavigate)
}

function startAccountConsole(
  config: AuthRuntimeConfig,
  navigate: string | ((url: string) => void) = (url) =>
    window.location.assign(url),
): string {
  if (typeof navigate !== "function") {
    throw new Error("Account console requires a navigation function")
  }
  const url = accountActionUrl(config)
  navigate(url)
  return url
}
