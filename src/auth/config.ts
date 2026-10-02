import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts"

/** Supported non-persistent token stores. */
export type AuthStorage = "memory" | "sessionStorage"

/** Deployment-time OIDC settings used to create the browser auth client. */
export interface AuthRuntimeConfig {
  authority: string
  clientId: string
  redirectUri: string
  postLogoutRedirectUri?: string
  silentRedirectUri?: string
  scope?: string
  storage?: AuthStorage
  automaticSilentRenew?: boolean
}

const required = (name: string, value: string): string => {
  if (!value.trim()) {
    throw new Error(`Auth configuration requires ${name}`)
  }

  return value
}

const webUrl = (name: string, value: string): string => {
  const parsed = new URL(required(name, value))

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Auth configuration ${name} must use http or https`)
  }

  return parsed.toString()
}

const authStorage = (storage: AuthStorage): Storage => {
  if (storage === "memory") {
    return new InMemoryWebStorage()
  }

  if (typeof window === "undefined") {
    throw new Error(
      "sessionStorage auth must be initialized in a browser; use memory storage during SSR",
    )
  }

  return window.sessionStorage
}

/** Creates an OIDC UserManager whose state never uses persistent local storage. */
export function createAuthUserManager(config: AuthRuntimeConfig): UserManager {
  const store = new WebStorageStateStore({
    store: authStorage(config.storage ?? "sessionStorage"),
  })
  const settings: UserManagerSettings = {
    authority: webUrl("authority", config.authority),
    client_id: required("clientId", config.clientId),
    redirect_uri: webUrl("redirectUri", config.redirectUri),
    scope: config.scope ?? "openid profile email",
    automaticSilentRenew:
      config.automaticSilentRenew ?? Boolean(config.silentRedirectUri),
    userStore: store,
    stateStore: store,
    ...(config.postLogoutRedirectUri
      ? {
          post_logout_redirect_uri: webUrl(
            "postLogoutRedirectUri",
            config.postLogoutRedirectUri,
          ),
        }
      : {}),
    ...(config.silentRedirectUri
      ? {
          silent_redirect_uri: webUrl(
            "silentRedirectUri",
            config.silentRedirectUri,
          ),
        }
      : {}),
  }

  return new UserManager(settings)
}
