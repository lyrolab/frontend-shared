/** Private envelope stored by the OIDC client, never sent as URL state. */
interface AccountActionState {
  __frontendSharedAccountAction: "v1"
  kcAction: string
  state: unknown
}

export const accountActionState = (
  kcAction: string,
  state: unknown,
): AccountActionState => ({
  __frontendSharedAccountAction: "v1",
  kcAction,
  state,
})

export function readAccountActionState(
  state: unknown,
): AccountActionState | undefined {
  if (
    typeof state === "object" &&
    state !== null &&
    "__frontendSharedAccountAction" in state &&
    state.__frontendSharedAccountAction === "v1" &&
    "kcAction" in state &&
    typeof state.kcAction === "string"
  ) {
    return state as AccountActionState
  }
  return undefined
}
