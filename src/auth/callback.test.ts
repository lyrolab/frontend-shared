import { ErrorResponse, User, type UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { startAccountAction } from "./actions.js"
import { createAuthCallbackHandler } from "./callback.js"

const callbackUrl = "https://quest.example/auth/callback"
const newUser = (state: unknown) =>
  new User({
    userState: state,
    access_token: "",
    token_type: "Bearer",
    profile: {
      sub: "test-subject",
      name: "Updated profile",
      iss: "https://identity.example",
      aud: "quest-player",
      exp: 2000000000,
      iat: 1000000000,
    },
    url_state: "caller-url-state",
  })

const managerFor = (
  user: User,
  response_mode: "query" | "fragment" = "query",
) =>
  ({
    settings: { response_mode, response_type: "code" },
    signinRedirectCallback: vi.fn().mockResolvedValue(user),
  }) as unknown as UserManager

const aiaUser = async (...states: [state?: unknown]) => {
  const state = states.length ? states[0] : { returnTo: "/account" }
  const signinRedirect = vi.fn().mockResolvedValue(undefined)
  await startAccountAction(
    { signinRedirect } as unknown as UserManager,
    "UPDATE_PROFILE",
    { state },
  )
  return newUser(
    JSON.parse(JSON.stringify(signinRedirect.mock.calls[0]![0].state)),
  )
}

describe("createAuthCallbackHandler", () => {
  it("keeps ordinary callbacks and one-argument navigation compatible", async () => {
    const user = newUser({ returnTo: "/projects/42" })
    const manager = managerFor(user)
    const navigate = vi.fn()
    const result = await createAuthCallbackHandler(manager, { navigate })(
      callbackUrl,
    )
    expect(result).toBe(user)
    expect(manager.signinRedirectCallback).toHaveBeenCalledWith(callbackUrl)
    expect(navigate).toHaveBeenCalledWith("/projects/42")
  })

  it.each(["success", "cancelled", "error"])(
    "returns %s only after a stored AIA callback is validated",
    async (status) => {
      const originalState = {
        returnTo: "/account?tab=profile#name",
        source: "settings",
      }
      const user = await aiaUser(originalState)
      const manager = managerFor(user)
      const navigate = vi.fn()
      const result = await createAuthCallbackHandler(manager, { navigate })(
        `${callbackUrl}?kc_action_status=${status}&kc_action=UPDATE_PROFILE`,
      )
      expect(navigate).toHaveBeenCalledWith(originalState.returnTo, {
        accountActionStatus: status,
      })
      expect(result).toBeInstanceOf(User)
      expect(result.state).toEqual(originalState)
      expect(result.profile).toEqual(user.profile)
      expect(result.url_state).toBe(user.url_state)
    },
  )
})

describe("AIA callback feedback", () => {
  it("captures and validates the same browser URL before an async callback changes it", async () => {
    const user = await aiaUser()
    const manager = managerFor(user)
    vi.mocked(manager.signinRedirectCallback).mockImplementation(
      async (url) => {
        expect(navigate).not.toHaveBeenCalled()
        expect(url).toContain("kc_action_status=cancelled")
        window.history.replaceState(
          {},
          "",
          "/auth/callback?kc_action_status=success",
        )
        return user
      },
    )
    const navigate = vi.fn()
    window.history.replaceState(
      {},
      "",
      "/auth/callback?kc_action_status=cancelled",
    )
    await createAuthCallbackHandler(manager, { navigate })()
    expect(navigate).toHaveBeenCalledWith("/account", {
      accountActionStatus: "cancelled",
    })
  })

  it("reads only the configured OIDC fragment response parameters", async () => {
    const manager = managerFor(await aiaUser(), "fragment")
    const navigate = vi.fn()
    await createAuthCallbackHandler(manager, { navigate })(
      `${callbackUrl}?kc_action_status=success#kc_action_status=cancelled`,
    )
    expect(navigate).toHaveBeenCalledWith("/account", {
      accountActionStatus: "cancelled",
    })
  })

  it.each([
    "",
    "?kc_action_status=unknown",
    "?kc_action_status=cancel",
    "?kc_action_status=SUCCESS",
    "?kc_action_status=success&kc_action_status=cancelled",
    "?kc_action_status=success&kc_action=UPDATE_EMAIL",
    "?kc_action_status=success&kc_action=UPDATE_PROFILE&kc_action=UPDATE_PROFILE",
    "#kc_action_status=success",
  ])(
    "ignores absent, unknown, ambiguous or mismatched feedback: %s",
    async (suffix) => {
      const navigate = vi.fn()
      await createAuthCallbackHandler(managerFor(await aiaUser()), {
        navigate,
      })(callbackUrl + suffix)
      expect(navigate).toHaveBeenCalledWith("/account")
    },
  )

  it("ignores spoofed status on an ordinary sign-in transaction", async () => {
    const navigate = vi.fn()
    await createAuthCallbackHandler(
      managerFor(newUser({ returnTo: "/account" })),
      { navigate },
    )(`${callbackUrl}?kc_action_status=success&kc_action=UPDATE_PROFILE`)
    expect(navigate).toHaveBeenCalledWith("/account")
  })

  it.each([
    new Error("No matching state found in storage"),
    new Error("token exchange failed"),
    new ErrorResponse({ error: "access_denied" }),
  ])(
    "propagates callback failures without trusting URL feedback",
    async (failure) => {
      const manager = managerFor(await aiaUser())
      vi.mocked(manager.signinRedirectCallback).mockRejectedValue(failure)
      const navigate = vi.fn()
      await expect(
        createAuthCallbackHandler(manager, { navigate })(
          `${callbackUrl}?kc_action_status=success&error=access_denied`,
        ),
      ).rejects.toBe(failure)
      expect(navigate).not.toHaveBeenCalled()
    },
  )
})

describe("callback return navigation", () => {
  it.each([
    "//attacker.example",
    "/\\attacker.example",
    "/\n/attacker.example",
    "https://attacker.example",
    "javascript:alert(1)",
    null,
  ])(
    "rejects unsafe returnTo %j for AIA and ordinary callbacks",
    async (returnTo) => {
      for (const user of [newUser({ returnTo }), await aiaUser({ returnTo })]) {
        const navigate = vi.fn()
        await createAuthCallbackHandler(managerFor(user), {
          fallbackPath: "/dashboard",
          navigate,
        })(callbackUrl)
        expect(navigate).toHaveBeenCalledWith("/dashboard")
      }
    },
  )

  it.each([undefined, null, "custom", 42, ["custom"]])(
    "restores custom state %j",
    async (state) => {
      const navigate = vi.fn()
      const result = await createAuthCallbackHandler(
        managerFor(await aiaUser(state)),
        { navigate },
      )(callbackUrl)
      expect(result.state).toEqual(state)
      expect(navigate).toHaveBeenCalledWith("/")
    },
  )

  it("rejects an unsafe fallback before processing the callback", () => {
    const manager = managerFor(newUser(undefined))
    expect(() =>
      createAuthCallbackHandler(manager, {
        fallbackPath: "//attacker.example",
      }),
    ).toThrow("local path")
    expect(manager.signinRedirectCallback).not.toHaveBeenCalled()
  })
})
