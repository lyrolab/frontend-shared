import type { InternalAxiosRequestConfig } from "axios"
import type { UserManager } from "oidc-client-ts"
import { describe, expect, it, vi } from "vitest"
import { createAuthInterceptor } from "./interceptor.js"

const request = (): InternalAxiosRequestConfig =>
  ({ headers: {} }) as InternalAxiosRequestConfig

describe("createAuthInterceptor", () => {
  it("injects the current access token", async () => {
    const userManager = {
      getUser: vi.fn().mockResolvedValue({
        access_token: "secret-access-token",
        expired: false,
      }),
    } as unknown as UserManager

    const result = await createAuthInterceptor(userManager)(request())

    expect(result.headers.get("Authorization")).toBe(
      "Bearer secret-access-token",
    )
  })

  it("leaves anonymous requests usable without an authorization header", async () => {
    const userManager = {
      getUser: vi.fn().mockResolvedValue(null),
    } as unknown as UserManager

    const result = await createAuthInterceptor(userManager)(request())

    expect(result.headers.Authorization).toBeUndefined()
  })
})
