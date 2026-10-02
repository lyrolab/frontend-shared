import { describe, expect, it, vi } from "vitest"
import { accountActionUrl, startAccountAction } from "./actions.js"
import type { AuthRuntimeConfig } from "./config.js"

const config: AuthRuntimeConfig = {
  authority: "https://identity.example/realms/acme/",
  clientId: "quest-player",
  redirectUri: "https://quest.example/auth/callback",
}

describe("account actions", () => {
  it("builds the account URL from runtime authority, client and redirect config", () => {
    const url = new URL(accountActionUrl(config))

    expect(url.origin + url.pathname).toBe(
      "https://identity.example/realms/acme/account/",
    )
    expect(url.searchParams.get("referrer")).toBe("quest-player")
    expect(url.searchParams.get("referrer_uri")).toBe(
      "https://quest.example/auth/callback",
    )
  })

  it("starts the account action with an injectable browser navigation", () => {
    const navigate = vi.fn()

    const url = startAccountAction(config, navigate)

    expect(navigate).toHaveBeenCalledWith(url)
  })
})
