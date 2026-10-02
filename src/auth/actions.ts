import type {
  SigninRedirectArgs,
  SignoutRedirectArgs,
  UserManager,
} from "oidc-client-ts"
import type { AuthRuntimeConfig } from "./config.js"

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

/** Builds the provider account-console URL without exposing a token. */
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

/** Navigates to the provider account console and returns the destination URL. */
export function startAccountAction(
  config: AuthRuntimeConfig,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): string {
  const url = accountActionUrl(config)
  navigate(url)
  return url
}
