// @vitest-environment node
import {
  ErrorResponse,
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type NavigateParams,
} from "oidc-client-ts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { startAccountAction } from "./actions.js"
import { createAuthCallbackHandler } from "./callback.js"

const authority = "https://identity.example/realms/quest"
const callbackUrl = "https://quest.example/auth/callback"

afterEach(() => vi.unstubAllGlobals())

const transaction = async (response_mode: "query" | "fragment" = "query") => {
  const storage = new InMemoryWebStorage()
  const store = new WebStorageStateStore({ store: storage })
  const navigate = vi.fn(async (params: NavigateParams) => ({
    url: params.url,
  }))
  const manager = new UserManager(
    {
      authority,
      client_id: "quest-player",
      redirect_uri: callbackUrl,
      response_type: "code",
      response_mode,
      scope: "openid profile email",
      automaticSilentRenew: false,
      loadUserInfo: false,
      stateStore: store,
      userStore: store,
      metadata: {
        issuer: authority,
        authorization_endpoint: `${authority}/protocol/openid-connect/auth`,
        token_endpoint: `${authority}/protocol/openid-connect/token`,
      },
    },
    {
      prepare: async () => ({ navigate, close: vi.fn() }),
      callback: vi.fn(),
    },
  )
  const state = { returnTo: "/account", source: "profile" }
  await startAccountAction(manager, "UPDATE_PROFILE", {
    state,
    ui_locales: "fr",
    nonce: "synthetic-test-nonce",
    url_state: "caller-url-state",
    extraQueryParams: { theme: "quest" },
  })
  const request = new URL(navigate.mock.calls[0]![0].url)
  return { manager, store, request, state }
}

const successfulExchange = () => {
  const encode = (value: unknown) => btoa(JSON.stringify(value))
  // Synthetic test data only. No live identity provider or user is contacted.
  const idToken = `${encode({ alg: "none" })}.${encode({
    sub: "test-subject",
    name: "Updated profile",
    nonce: "synthetic-test-nonce",
  })}.`
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(
        JSON.stringify({
          access_token: "synthetic-test-access-token",
          id_token: idToken,
          token_type: "Bearer",
          scope: "openid profile email",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("AIA with the real OIDC client", () => {
  it.each(["query", "fragment"] as const)(
    "retains generated state/PKCE and restores refreshed profile through a %s callback",
    async (responseMode) => {
      const { manager, store, request, state } = await transaction(responseMode)
      const opaqueState = request.searchParams.get("state")!
      const stateId = opaqueState.split(";")[0]!
      const saved = JSON.parse((await store.get(stateId))!)
      const fetch = successfulExchange()
      const navigate = vi.fn()
      const complete = createAuthCallbackHandler(manager, { navigate })
      const params = new URLSearchParams({
        state: opaqueState,
        code: "synthetic-test-code",
        kc_action: "UPDATE_PROFILE",
        kc_action_status: "success",
      })
      const callback = `${callbackUrl}${responseMode === "query" ? "?" : "#"}${params}`
      const user = await complete(callback)

      expect(request.pathname).toBe(
        "/realms/quest/protocol/openid-connect/auth",
      )
      expect(request.searchParams.get("kc_action")).toBe("UPDATE_PROFILE")
      expect(request.searchParams.get("redirect_uri")).toBe(callbackUrl)
      expect(request.searchParams.get("ui_locales")).toBe("fr")
      expect(request.searchParams.get("theme")).toBe("quest")
      expect(request.searchParams.get("code_challenge_method")).toBe("S256")
      expect(request.searchParams.get("code_challenge")).toBeTruthy()
      expect(opaqueState).not.toContain("returnTo")
      expect(saved.code_verifier).toBeTruthy()
      expect(saved.data.state).toEqual(state)
      expect(saved.data.kcAction).toBe("UPDATE_PROFILE")
      const body = new URLSearchParams(fetch.mock.calls[0]![1]?.body as string)
      expect(body.get("code_verifier")).toBe(saved.code_verifier)
      expect(body.get("redirect_uri")).toBe(callbackUrl)
      expect(user.state).toEqual(state)
      expect(user.url_state).toBe("caller-url-state")
      expect(user.profile.name).toBe("Updated profile")
      expect((await manager.getUser())?.profile.name).toBe("Updated profile")
      expect(navigate).toHaveBeenCalledExactlyOnceWith("/account", {
        accountActionStatus: "success",
      })
      expect(await store.get(stateId)).toBeFalsy()
      await expect(complete(callback)).rejects.toThrow("No matching state")
      expect(navigate).toHaveBeenCalledTimes(1)
    },
  )

  it("rejects spoofed state without exchanging a code or exposing feedback", async () => {
    const { manager } = await transaction()
    const fetch = successfulExchange()
    const navigate = vi.fn()
    await expect(
      createAuthCallbackHandler(manager, { navigate })(
        `${callbackUrl}?state=not-a-stored-transaction&code=synthetic-test-code&kc_action_status=success`,
      ),
    ).rejects.toThrow("No matching state")
    expect(fetch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("preserves OIDC ErrorResponse rejection for a correlated AIA failure", async () => {
    const { manager, request } = await transaction()
    const fetch = successfulExchange()
    const navigate = vi.fn()
    const params = new URLSearchParams({
      state: request.searchParams.get("state")!,
      error: "access_denied",
      kc_action_status: "success",
    })
    await expect(
      createAuthCallbackHandler(manager, { navigate })(
        `${callbackUrl}?${params}`,
      ),
    ).rejects.toBeInstanceOf(ErrorResponse)
    expect(fetch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
