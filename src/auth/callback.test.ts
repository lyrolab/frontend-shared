import type { UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { createAuthCallbackHandler } from "./callback.js"

describe("createAuthCallbackHandler", () => {
  it("completes the callback and returns to a same-origin path", async () => {
    const user = { state: { returnTo: "/projects/42" } }
    const userManager = {
      signinRedirectCallback: vi.fn().mockResolvedValue(user),
    } as unknown as UserManager
    const navigate = vi.fn()

    await createAuthCallbackHandler(userManager, { navigate })()

    expect(navigate).toHaveBeenCalledWith("/projects/42")
  })

  it("rejects protocol-relative callback targets", async () => {
    const userManager = {
      signinRedirectCallback: vi
        .fn()
        .mockResolvedValue({ state: { returnTo: "//attacker.example" } }),
    } as unknown as UserManager
    const navigate = vi.fn()

    await createAuthCallbackHandler(userManager, {
      fallbackPath: "/dashboard",
      navigate,
    })()

    expect(navigate).toHaveBeenCalledWith("/dashboard")
  })
})
