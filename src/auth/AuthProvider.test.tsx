import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { AuthProvider } from "./AuthProvider.js"
import { useAuth, useCurrentUser } from "./context.js"

const anonymousUserManager = (): UserManager => {
  const events = {
    addAccessTokenExpired: vi.fn(),
    addUserLoaded: vi.fn(),
    addUserUnloaded: vi.fn(),
    removeAccessTokenExpired: vi.fn(),
    removeUserLoaded: vi.fn(),
    removeUserUnloaded: vi.fn(),
  }

  return {
    events,
    getUser: vi.fn().mockResolvedValue(null),
  } as unknown as UserManager
}

function AnonymousPage() {
  const { isLoading } = useAuth()
  const user = useCurrentUser()

  return (
    <main>
      <p>{isLoading ? "Checking session" : "Public content"}</p>
      {!user && <button type="button">Sign in</button>}
    </main>
  )
}

describe("AuthProvider", () => {
  it("keeps anonymous pages usable and exposes a sign-in prompt", async () => {
    render(
      <AuthProvider userManager={anonymousUserManager()}>
        <AnonymousPage />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText("Public content")).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
  })
})
