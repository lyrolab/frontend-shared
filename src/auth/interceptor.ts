import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios"
import type { UserManager } from "oidc-client-ts"

/** Creates an axios request interceptor that injects a live bearer token when present. */
export function createAuthInterceptor(
  userManager: UserManager,
): (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig> {
  return async (config) => {
    const user = await userManager.getUser()

    if (user?.access_token && !user.expired) {
      const headers = AxiosHeaders.from(config.headers)

      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${user.access_token}`)
      }

      return { ...config, headers }
    }

    return config
  }
}
