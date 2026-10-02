import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"

// Packs this package and lints a small React + TypeScript app in a throwaway pnpm
// project with hoisting disabled, so any runtime import that isn't a declared
// dependency fails to resolve.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const pnpm = process.env.PNPM_BIN ?? "pnpm"
const { name: presetName } = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
)

const SOURCES = {
  "src/Greeting.tsx": `export const Greeting = ({ name }: { name: string }) => (
  <p className="greeting-text">Hello {name}</p>
)
`,
  "src/Greeting.test.tsx": `export const Fixture = () => <div>Plain test text</div>
`,
  "src/Button.tsx": `export const Button = ({ label }: { label: string }) => (
  <button type="button">{label}</button>
)
`,
  "src/Button.stories.tsx": `import { Button } from "./Button"

const Row = () => (
  <div>
    <Button label="a" />
  </div>
)

const Stack = () => (
  <section>
    <Row />
  </section>
)

const meta = { component: Button }
export default meta

export const Primary = { args: { label: "a" } }
export const InStack = { render: () => <Stack /> }
`,
  "src/NoMeta.stories.tsx": `export const Lonely = {}
`,
  "src/auth.ts": `import {
  accountActionUrl,
  createAuthCallbackHandler,
  startAccountAction,
  type AccountActionStatus,
  type AuthCallbackNavigation,
  type AuthRuntimeConfig,
} from "@lyrolab/frontend-shared/auth"
import type { SigninRedirectArgs, UserManager } from "oidc-client-ts"

const config: AuthRuntimeConfig = {
  authority: "https://identity.example/realms/example",
  clientId: "consumer",
  redirectUri: "https://app.example/auth/callback",
}

export const url = accountActionUrl(config)
export const legacyAction: (config: AuthRuntimeConfig, navigate?: (url: string) => void) => string = startAccountAction
export const updateProfile = (manager: UserManager, args?: SigninRedirectArgs): Promise<void> =>
  startAccountAction(manager, "UPDATE_PROFILE", args)
export const completeCallback = (manager: UserManager) => createAuthCallbackHandler(manager, {
  navigate: (path: string, result?: AuthCallbackNavigation) => {
    const status: AccountActionStatus | undefined = result?.accountActionStatus
    return { path, status }
  },
})
`,
}

const CONFIGS = {
  default: "{}",
  i18n: "{ i18n: true }",
  i18nIgnore: '{ i18n: { ignoreWords: ["^Hello$"] } }',
  storybook: "{ storybook: true }",
}

let dir

const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, stdio: "pipe" })

const lint = (variant) => {
  const res = spawnSync(
    join(dir, "node_modules/.bin/eslint"),
    ["--config", `eslint.${variant}.config.mjs`, "--format", "json", "src"],
    { cwd: dir, encoding: "utf8" },
  )
  assert.ok(
    res.status === 0 || res.status === 1,
    `eslint crashed for "${variant}":\n${res.stderr}`,
  )
  const results = JSON.parse(res.stdout)
  const fatal = results.flatMap((r) => r.messages.filter((m) => m.fatal))
  assert.deepEqual(fatal, [], `parse errors for "${variant}"`)
  return (file, ruleId) =>
    results
      .find((r) => r.filePath.endsWith(file))
      .messages.filter((m) => m.ruleId === ruleId)
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), "preset-pnpm-"))
  execFileSync("npm", ["pack", "--pack-destination", dir], {
    cwd: repoRoot,
    stdio: "pipe",
  })
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"))

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      name: "pnpm-consumer",
      private: true,
      type: "module",
      devDependencies: {
        [presetName]: `file:./${tarball}`,
        "@tanstack/react-router": "^1.170.0",
        "@types/react": "^19.0.0",
        axios: "^1.7.0",
        eslint: "^9.0.0",
        "oidc-client-ts": "3.1.0",
        prettier: "^3.0.0",
        react: "^19.0.0",
        typescript: "~6.0.0",
      },
    }),
  )
  writeFileSync(
    join(dir, ".npmrc"),
    "node-linker=isolated\nhoist=false\nshamefully-hoist=false\n",
  )
  writeFileSync(
    join(dir, "pnpm-workspace.yaml"),
    "nodeLinker: isolated\nhoist: false\nshamefullyHoist: false\n",
  )
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      extends: `${presetName}/tsconfig`,
      compilerOptions: { types: [] },
      include: ["src"],
    }),
  )
  writeFileSync(
    join(dir, ".prettierrc.json"),
    JSON.stringify({ semi: false, trailingComma: "all" }),
  )
  for (const [variant, options] of Object.entries(CONFIGS)) {
    writeFileSync(
      join(dir, `eslint.${variant}.config.mjs`),
      `import preset from "${presetName}/eslint"\nexport default preset(${options})\n`,
    )
  }
  mkdirSync(join(dir, "src"))
  for (const [file, source] of Object.entries(SOURCES)) {
    writeFileSync(join(dir, file), source)
  }

  run(pnpm, ["install"])
})

after(() => {
  if (dir && !process.env.KEEP_TMP)
    rmSync(dir, { recursive: true, force: true })
})

test("tsconfig preset type-checks the sample", () => {
  run(join(dir, "node_modules/.bin/tsc"), ["--noEmit", "-p", "."])
})

test("auth subpath loads in a Quest-compatible React 19 consumer", () => {
  const output = run("node", [
    "--input-type=module",
    "--eval",
    `import { accountActionUrl } from "${presetName}/auth";
     process.stdout.write(accountActionUrl({
       authority: "https://identity.example/realms/example",
       clientId: "player",
       redirectUri: "https://quest.example/auth/callback",
     }))`,
  ])
  assert.match(output.toString(), /\/realms\/example\/account\//)
})

test("default options lint without i18n or storybook rules", () => {
  const messages = lint("default")
  assert.equal(messages("Greeting.tsx", "i18next/no-literal-string").length, 0)
  assert.equal(
    messages("Button.stories.tsx", "react/no-multi-comp").length,
    1,
    "stories are held to the one-component rule by default",
  )
  assert.equal(
    messages("NoMeta.stories.tsx", "storybook/default-exports").length,
    0,
  )
})

test("i18n flags literal JSX text only, outside tests and stories", () => {
  const messages = lint("i18n")
  const literal = messages("Greeting.tsx", "i18next/no-literal-string")
  assert.equal(literal.length, 1, "JSX text is flagged, className is not")
  assert.equal(
    messages("Greeting.test.tsx", "i18next/no-literal-string").length,
    0,
  )
  assert.equal(
    messages("Button.stories.tsx", "i18next/no-literal-string").length,
    0,
  )
})

test("i18n ignoreWords allows listed words", () => {
  const messages = lint("i18nIgnore")
  assert.equal(messages("Greeting.tsx", "i18next/no-literal-string").length, 0)
})

test("storybook applies recommended rules and relaxes component rules in stories", () => {
  const messages = lint("storybook")
  assert.equal(messages("Button.stories.tsx", "react/no-multi-comp").length, 0)
  assert.equal(
    messages("NoMeta.stories.tsx", "storybook/default-exports").length,
    1,
  )
})
