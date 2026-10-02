import type { SigninRedirectArgs, UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { accountActionUrl, startAccountAction } from "./actions.js"
import { readAccountActionState } from "./account-state.js"
import type { AuthRuntimeConfig } from "./config.js"

const config: AuthRuntimeConfig = {
  authority: "https://identity.example/realms/acme/",
  clientId: "quest-player",
  redirectUri: "https://quest.example/auth/callback",
}

const actions = [
  "UPDATE_PASSWORD",
  "UPDATE_EMAIL",
  "CONFIGURE_TOTP",
  "UPDATE_PROFILE",
]

describe("account actions", () => {
  it("preserves the deprecated account console URL and injectable navigation", () => {
    const navigate = vi.fn()
    const destination = startAccountAction(config, navigate)
    const url = new URL(destination)

    expect(destination).toBe(accountActionUrl(config))
    expect(url.origin + url.pathname).toBe(
      "https://identity.example/realms/acme/account/",
    )
    expect(url.searchParams.get("referrer")).toBe("quest-player")
    expect(url.searchParams.get("referrer_uri")).toBe(config.redirectUri)
    expect(navigate).toHaveBeenCalledWith(destination)
  })

  it.each(actions)("requests %s through signinRedirect", async (kcAction) => {
    const signinRedirect = vi.fn().mockResolvedValue(undefined)
    const userManager = { signinRedirect } as unknown as UserManager
    const state = Object.freeze({ returnTo: "/account", source: "settings" })
    const args: SigninRedirectArgs = Object.freeze({
      state,
      redirect_uri: config.redirectUri,
      ui_locales: "fr",
      prompt: "login",
      max_age: 0,
      scope: "openid profile email",
      redirectMethod: "replace",
      url_state: "caller-url-state",
      extraTokenParams: { audience: "player" },
      extraQueryParams: Object.freeze({ theme: "quest", kc_action: "wrong" }),
    })

    const promise = startAccountAction(userManager, kcAction, args)
    await promise

    const request = signinRedirect.mock.calls[0]![0] as SigninRedirectArgs
    expect(request).toEqual({
      ...args,
      state: expect.any(Object),
      extraQueryParams: { theme: "quest", kc_action: kcAction },
    })
    expect(readAccountActionState(request.state)).toEqual({
      __frontendSharedAccountAction: "v1",
      kcAction,
      state,
    })
    expect(readAccountActionState(request.state)?.state).toBe(state)
    expect(args.extraQueryParams?.kc_action).toBe("wrong")
    expect(request.redirect_uri).toBe(config.redirectUri)
  })

  it.each([undefined, null, "custom", 42, ["custom"]])(
    "preserves custom state %j in the stored envelope",
    async (state) => {
      const signinRedirect = vi.fn().mockResolvedValue(undefined)
      const manager = { signinRedirect } as unknown as UserManager
      await startAccountAction(manager, "UPDATE_PROFILE", { state })
      // undefined state is omitted by OIDC JSON storage, but the marker survives.
      const storedState: unknown = JSON.parse(
        JSON.stringify(signinRedirect.mock.calls[0]![0].state),
      )
      expect(readAccountActionState(storedState)?.state).toEqual(state)
    },
  )

  it("delegates redirect failures without navigation or a fallback console", async () => {
    const failure = new Error("redirect unavailable")
    const manager = {
      signinRedirect: vi.fn().mockRejectedValue(failure),
    } as unknown as UserManager
    await expect(startAccountAction(manager, "UPDATE_EMAIL")).rejects.toBe(
      failure,
    )
  })

  it.each(["", "   "])(
    "rejects an empty action before redirect: %j",
    (action) => {
      const signinRedirect = vi.fn()
      const manager = { signinRedirect } as unknown as UserManager
      expect(() => startAccountAction(manager, action)).toThrow(
        "Account action requires a Keycloak action name",
      )
      expect(signinRedirect).not.toHaveBeenCalled()
    },
  )
})
