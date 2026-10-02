import { redirect } from "@tanstack/react-router"
import type { UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { requireAuth } from "./guard.js"

vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn((options: unknown) =>
    Object.assign(new Error("redirect"), { options }),
  ),
}))

describe("requireAuth", () => {
  it("redirects an anonymous visitor and preserves the requested location", async () => {
    const userManager = {
      getUser: vi.fn().mockResolvedValue(null),
    } as unknown as UserManager
    const beforeLoad = requireAuth({ userManager, loginPath: "/sign-in" })

    await expect(
      beforeLoad({ location: { href: "/projects/42?tab=notes" } }),
    ).rejects.toThrow("redirect")
    expect(redirect).toHaveBeenCalledWith({
      href: "/sign-in?returnTo=%2Fprojects%2F42%3Ftab%3Dnotes",
    })
  })
})
