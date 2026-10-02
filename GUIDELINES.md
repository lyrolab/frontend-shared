# Frontend Architecture Guidelines

The shared, UI-agnostic architecture contract for Lyrolab web frontends. The ESLint preset in this
package mechanically enforces the parts that can be enforced; this document is the full contract.

Scope: architecture, data layer, forms, state, testing, UI components, i18n, Storybook, tooling
and workspaces. Out of scope: which UI library to use and styling conventions — those stay
per-project.

---

## 1. Stack baseline

Every project uses: **React** · **Vite** · **TanStack Router** · **TanStack Query v5** ·
**React Hook Form + Zod** · an **OpenAPI-generated `typescript-axios` client** ·
**Vitest + Testing Library + MSW** · **OIDC/Keycloak** ·
**Prettier `{ semi: false, singleQuote: false, trailingComma: "all" }`** · **TypeScript strict**.

The UI library, styling solution, and SSR are per-project choices and out of this contract. New
projects default to **MUI Material**.

## 2. Module architecture

Code is organized as **feature modules** under `src/modules/<feature>/`. A module owns a slice of
the product and contains only these directories (create them as needed, omit the empty ones):

```
src/modules/<feature>/
  pages/           Module entrypoints. Thin wrappers. One page per route.
  components/       Presentation + local orchestration. UI-only files use the *UI.tsx suffix.
  business/         Domain hooks and logic that don't belong to a single component.
  data/
    queries/        React Query hook wrappers, one file per entity (plural: conversations.ts).
    mappers/        DTO → domain-type mapping, one file per entity. (Optional but recommended.)
  types/            Domain entities and internal types.
  store/            Zustand stores, when the module needs cross-component client state.
```

**Naming is fixed** so tooling and humans can rely on it: `pages/` for entrypoints, and the data
layer lives under `data/queries/` (never a top-level `queries/`). Shared, cross-module primitives
live in a top-level `src/components/` (the UI kit) and `src/lib/` (providers, api-client factory,
utils).

## 3. The three layers

Data flows in one direction: **data layer → business layer → presentation layer**. Each layer has
one job and does not reach across.

### 3.1 Presentation (`components/`, `pages/`)

- **Pages are thin wrappers.** A page reads route params, wraps its content in
  `SuspenseErrorBoundary`, and renders one business component. **No data fetching, no React Query
  hooks, no business logic in a page.**
  ```tsx
  const ConversationPage = () => {
    const { conversationId } = useParams()
    return (
      <SuspenseErrorBoundary>
        <ConversationContent conversationId={conversationId} />
      </SuspenseErrorBoundary>
    )
  }
  ```
- **Two kinds of components:**
  - **Business components** — call business hooks / `useSuspenseQuery`, orchestrate, pass plain
    props down. They may fetch (through the data layer) and mutate.
  - **Pure UI components** — presentation only, no data/business hooks, driven entirely by props.
    Name them with the **`*UI.tsx` suffix** (`MessageListUI.tsx`). This makes "is this file
    allowed to fetch?" greppable.
- **One component per file.** If a file grows past ~150 lines or holds a second component, split
  it into a subfolder. Prefer many small files in feature subfolders over few large files.

### 3.2 Business (`business/`)

Domain hooks and logic that outgrow a single component: state machines, derived-data hooks,
orchestration across several queries/mutations. Business hooks may compose data-layer hooks; they
must not call the API client or React Query primitives directly.

### 3.3 Data (`data/queries/`, `data/mappers/`)

The **only** place React Query and the API client are touched.

- **One wrapper file per entity**, named in plural: `data/queries/conversations.ts`.
- Wrap every query/mutation in a hook. **Components never call `useQuery`/`useMutation` directly**
  — this is lint-enforced (`no-restricted-imports`).
- Get the API client through the project's factory and unwrap `.then(({ data }) => data)`.
- **Prefer `useSuspenseQuery`** — Suspense + ErrorBoundary handle loading/error, so no manual
  `isLoading`/`isError` in components.
- **Query keys are array-based and descriptive:** `["conversations", conversationId]`. Export a
  key factory when a key is reused across hooks.
- **No try/catch** — React Query's global error handling + `SuspenseErrorBoundary` own errors.
- **Mutations `await invalidateQueries`** in an `async onSuccess`; use `Promise.all` for several:
  ```ts
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversation", id] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ])
  }
  ```
- **Map DTOs to domain types** in `data/mappers/` and apply the mapper via `select` (or at the
  edge of the wrapper hook). Components and business code see domain types, never raw generated
  DTOs. Recommended everywhere; optional where the DTO already fits.

### 3.4 Errors & Suspense

- Each project owns **one** `SuspenseErrorBoundary` primitive (Suspense plus `react-error-boundary`,
  with a reset that calls `queryClient.resetQueries`). Wrap pages and long-lived layouts in it.
- Cross-cutting concerns (401 → login redirect, opt-in error toasts) live on the `QueryClient`'s
  `QueryCache`/`MutationCache` `onError`, not scattered in components.

## 4. Forms

- **React Hook Form + Zod for every form**, even a single field. Always `zodResolver`.
- **Container / presentational split:** the parent fetches data, calls the mutation, and handles
  success/error/navigation, and **never holds the RHF state**. A dedicated form component owns
  `useForm` + the Zod schema and renders the fields.
- The form passes `{ setError, reset }` back to the parent's `onSubmit` so the parent can set
  field-level API errors or reset after success.
- **Field wrappers:** projects with a `Form*` wrapper library use it; projects without one wire
  fields through `Controller`. The mandated contract is the _pattern_, not specific components.

## 5. State management

- **Server state → React Query.** Never mirror server data into Zustand/Context.
- **Client/UI state → Zustand** (stores in the module's `store/`) for anything shared across
  components; `useState`/`useReducer` for local state.
- **React Context** for dependency-injection-style values (auth user, app config, theme) — not as
  a general state store. Don't hand-roll a Context+`useState` "store" where a Zustand store fits.

## 6. API client

- The typed client is **generated from the backend's OpenAPI spec** (`typescript-axios`) into
  `src/clients/…` and regenerated by a project script. **Never hand-edit generated files**; they
  are lint/prettier-ignored.
- Access the client through a single factory that injects the Keycloak bearer token via an axios
  interceptor. Wrapper hooks in `data/queries/` are the only callers.

### 6.1 Shared auth runtime

- Use `@lyrolab/frontend-shared/auth` for OIDC wiring. Supply `authority`, `clientId`, and redirect
  URLs from runtime deployment configuration; never bake environment-specific identity URLs into
  an application bundle.
- Wrap the router in `AuthProvider`, but protect only private routes with `requireAuth(...)` in
  TanStack Router's `beforeLoad`. The provider never initiates login by itself: public and
  optional-auth pages must remain usable when `useCurrentUser()` returns `null` and may present a
  sign-in prompt.
- Complete the authorization response with `createAuthCallbackHandler`, and keep callback and
  post-logout URLs on the identity provider's exact allowlist. Return locations must be same-origin
  paths, never arbitrary URLs.
- Install `createAuthInterceptor` on the generated client's axios instance. It adds a bearer token
  only for a live authenticated user and leaves anonymous requests untouched.
- Tokens and OIDC transaction state may live only in memory or `sessionStorage`. Never put them in
  `localStorage`, URLs, analytics, errors, debug output, or application logs.
- Use the exported `login`, `register`, `logout`, and `startAccountAction` helpers instead of
  constructing provider URLs in UI components. Application-specific login screens and account UI
  remain in the consuming project.
- In-app account pages must use `startAccountAction(userManager, kcAction, args)` for Keycloak AIA
  (`UPDATE_PASSWORD`, `UPDATE_EMAIL`, `CONFIGURE_TOTP`, `UPDATE_PROFILE`), never the deprecated
  account-console overload. Keep the redirect at the OIDC callback and set `state.returnTo` to a
  local Account path. Complete through `createAuthCallbackHandler` to unwrap transaction state.
- Callback `navigate(path, result?)` receives optional `accountActionStatus` (`success`,
  `cancelled`, `error`) only after OIDC validation of a stored AIA transaction. Forward only this
  normalized feedback to the Account page; never raw callback parameters. OIDC errors reject
  without navigation. Status is feedback, not evidence that MFA or another security policy is
  satisfied. Verify realm action configuration, especially `UPDATE_EMAIL`, before claiming QA.

## 7. Testing

- **Vitest + Testing Library + MSW**, jsdom environment. Tests are **colocated** next to source
  (`Foo.test.tsx` beside `Foo.tsx`).
- Use a shared `renderWithProviders` / `Wrapper` (router + QueryClient + theme) and **MSW** to
  stub the API — do not mock the generated client by hand.
- **Query by role/accessible name** (`getByRole("button", { name: /…/ })`), not by test id or
  `container`. No snapshot tests of whole trees; no `fireEvent` where `userEvent` fits.
- The `test` script must run once in CI (`vitest --run`), and **tests must be a CI gate**.

## 8. UI components

- **Composition over inheritance.** Build UI by composing small components: pass content through
  `children` or named slot props (`header`, `actions`, `icon`) and behaviour through props. No
  class hierarchies, no "base component" to extend.
- **No wrapper-variant sprawl.** Don't create `PrimaryButton`, `DangerButton`, `SmallDangerButton`
  wrappers around one component — expose a `variant`/`size` prop, or compose at the call site.
- **Keep files tiny.** One component per file. Split into sub-components in a subfolder as soon as
  a component has a distinct visual block or its own state — well before the lint limits (one
  component per file, ~150-line functions) kick in.
  ```tsx
  const Card = ({ header, actions, children }: CardProps) => (
    <section>
      <CardHeader actions={actions}>{header}</CardHeader>
      {children}
    </section>
  )
  ```

## 9. Internationalization

- **No literal user-facing text in JSX.** Every visible string goes through the translation
  function (`t("feature.key")`). Enable `i18n: true` in the ESLint preset to enforce it; it
  flags JSX text only (not attributes like `className`) and skips test and story files.
- **Keys are namespaced per feature module:** one namespace (or top-level key) per
  `src/modules/<feature>/`, so a feature's strings move and get deleted with it. Shared strings
  live in a `common` namespace.
- **Locale parity is tested.** A unit test asserts every locale has exactly the same key set as
  the reference locale, so a missing translation fails CI instead of showing a raw key.

## 10. Storybook

- **Stories are co-located** as `Component.stories.tsx` next to `Component.tsx`.
- **One story file per component** — no catch-all story files for a whole feature.
- **Stories cover every state** the component can render: default, loading, empty, error,
  disabled, long content, and each variant. A state without a story is a state nobody reviews.
- Enable `storybook: true` in the ESLint preset: it applies the Storybook recommended rules to
  `*.stories.@(ts|tsx)` and relaxes one-component-per-file and function length there, where
  decorators and render helpers legitimately live beside the stories.

## 11. pnpm workspaces

- **Install from the workspace root** with `pnpm install`; commit `pnpm-lock.yaml`. Add a
  dependency to one package with `pnpm --filter <package> add <dep>`.
- **Run scripts per package with filters:** `pnpm --filter <package> test`, or
  `pnpm -r --filter "./apps/*" build` for a group. Prefer filters over `cd`-ing into packages.
- **Never rely on hoisting.** Every package declares every dependency it imports; don't enable
  `shamefully-hoist` or `public-hoist-pattern` to paper over a missing declaration. This preset
  bundles all of its ESLint plugins as dependencies, so a consuming app only installs `eslint`,
  `prettier`, `typescript` and the preset.

## 12. Tooling & conventions

- **ESLint:** consume the shared preset — `import { lyrolabFrontend } from "@lyrolab/frontend-shared/eslint"`.
  It provides `typescript-eslint` + `react-hooks` + Prettier + the architecture guardrails:
  React Query hooks are confined to `data/queries/`, the **data layer may not import the
  presentation layer** (`components/`, `pages/`, `entrypoints/`, `layout/`), one component per
  file is enforced, and functions over ~150 lines warn. See the README for options.
- **Prettier:** the shared config. Never hand-fix formatting — run the project's format script.
- **tsconfig:** extend `@lyrolab/frontend-shared/tsconfig`; keep `strict: true` and path aliases.
  Set `compilerOptions.types` explicitly (e.g. `["vite/client"]`) — TypeScript 6 no longer
  includes every `@types/*` package by default.
- **Commits:** conventional commits (enforced by commitlint/husky at the repo root).
- **No legacy libraries in new code:** no Formik/Yup (use RHF+Zod), no Bootstrap, no `swr` (use
  React Query). Migrate on touch.

## 13. Quick checklist (PR review)

- [ ] New code lives under `src/modules/<feature>/` in the right layer.
- [ ] Page is a thin `SuspenseErrorBoundary` wrapper — no fetching in it.
- [ ] React Query is only in `data/queries/`; components use wrapper hooks.
- [ ] Array query keys; no try/catch; `await invalidateQueries`.
- [ ] DTOs mapped to domain types before reaching components.
- [ ] Form uses RHF + Zod with the container/presentational split.
- [ ] One component per file; pure-UI files use `*UI.tsx`.
- [ ] Components composed via children/slots and props — no inheritance or variant wrappers.
- [ ] No literal JSX text; new keys added to every locale under the feature namespace.
- [ ] Co-located story covering every state of a new or changed UI component.
- [ ] Server state in React Query, client state in Zustand — not mixed.
- [ ] Protected routes opt in with `requireAuth`; anonymous routes still render without a session.
- [ ] Auth tokens are never logged and use only memory or `sessionStorage`.
- [ ] Test colocated, role-based, MSW-backed; passes in CI.
