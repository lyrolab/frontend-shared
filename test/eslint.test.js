import assert from "node:assert/strict"
import { test } from "node:test"

import createConfig from "../src/eslint/index.js"

// The base (all-files) group is the one that also declares the react-hooks rules.
const baseGroup = (config) =>
  config.find((c) => c.rules?.["react-hooks/rules-of-hooks"])

test("returns a non-empty flat config array", () => {
  const config = createConfig()
  assert.ok(Array.isArray(config))
  assert.ok(config.length > 0)
})

test("react-hooks rules are enforced", () => {
  const config = createConfig()
  const base = config.find((c) => c.rules?.["react-hooks/rules-of-hooks"])
  assert.equal(base.rules["react-hooks/rules-of-hooks"], "error")
  assert.equal(base.rules["react-hooks/exhaustive-deps"], "warn")
  assert.equal(base.rules["react/no-multi-comp"][0], "error")
})

test("React Query hooks are restricted by default", () => {
  const config = createConfig()
  const rule = baseGroup(config).rules["no-restricted-imports"]
  assert.equal(rule[0], "error")
  const names = rule[1].paths.flatMap((p) => p.importNames ?? [])
  assert.ok(names.includes("useSuspenseQuery"))
})

test("data/queries dir exempts React Query but keeps other restrictions", () => {
  const config = createConfig({
    dataQueryDirs: ["data/queries"],
    restrictedWrapperImports: [
      { name: "posthog-js", allowedDir: "modules/analytics" },
    ],
  })
  const dqEntry = config.find((c) => c.files?.[0] === "**/data/queries/**")
  const rule = dqEntry.rules["no-restricted-imports"]
  // React Query is allowed here, but posthog-js must still be restricted.
  const pathNames = rule[1].paths.map((p) => p.name)
  assert.ok(!pathNames.includes("@tanstack/react-query"))
  assert.ok(pathNames.includes("posthog-js"))
})

test("wrapper dir exempts its own module but keeps React Query restricted", () => {
  const config = createConfig({
    restrictedWrapperImports: [
      { name: "posthog-js", allowedDir: "modules/analytics" },
    ],
  })
  const wrapperEntry = config.find(
    (c) => c.files?.[0] === "**/modules/analytics/**",
  )
  const rule = wrapperEntry.rules["no-restricted-imports"]
  const pathNames = rule[1].paths.map((p) => p.name)
  assert.ok(!pathNames.includes("posthog-js"))
  assert.ok(pathNames.includes("@tanstack/react-query"))
})

test("data dir bans importing the presentation layer", () => {
  const config = createConfig({ dataQueryDirs: ["queries"] })
  const dqEntry = config.find((c) => c.files?.[0] === "**/queries/**")
  const patterns = dqEntry.rules["no-restricted-imports"][1].patterns
  const groups = patterns.flatMap((p) => p.group)
  assert.ok(groups.includes("**/components/**"))
  assert.ok(groups.includes("**/pages/**"))
})

test("max-lines-per-function is a warn at the configured threshold", () => {
  const base = baseGroup(createConfig())
  const rule = base.rules["max-lines-per-function"]
  assert.equal(rule[0], "warn")
  assert.equal(rule[1].max, 150)

  const custom = baseGroup(createConfig({ maxLinesPerFunction: 200 }))
  assert.equal(custom.rules["max-lines-per-function"][1].max, 200)
})

test("max-lines-per-function can be disabled", () => {
  const base = baseGroup(createConfig({ maxLinesPerFunction: false }))
  assert.equal(base.rules["max-lines-per-function"], undefined)
})

test("typeChecked adds parserOptions.projectService", () => {
  const config = createConfig({ typeChecked: true })
  const tc = config.find(
    (c) => c.languageOptions?.parserOptions?.projectService,
  )
  assert.ok(tc)
})

test("i18n and storybook are off by default", () => {
  const config = createConfig()
  assert.ok(!config.some((c) => c.plugins?.i18next))
  assert.ok(!config.some((c) => c.plugins?.storybook))
})

test("i18n checks JSX text only and skips tests and stories", () => {
  const config = createConfig({
    i18n: { ignoreWords: ["^OK$"], ignoreFiles: ["**/dev/**"] },
  })
  const entry = config.find((c) => c.plugins?.i18next)
  const [level, options] = entry.rules["i18next/no-literal-string"]
  assert.equal(level, "error")
  assert.equal(options.mode, "jsx-text-only")
  assert.ok(options.words.exclude.includes("^OK$"))
  assert.ok(options.words.exclude.includes("[A-Z_-]+"))
  assert.ok(entry.ignores.includes("**/*.{test,spec}.{ts,tsx,js,jsx}"))
  assert.ok(entry.ignores.includes("**/*.stories.@(ts|tsx)"))
  assert.ok(entry.ignores.includes("**/dev/**"))
})

test("storybook enables recommended rules and relaxes component rules in stories", () => {
  const config = createConfig({ storybook: true })
  const entry = config.find((c) => c.plugins?.storybook)
  assert.deepEqual(entry.files, ["**/*.stories.@(ts|tsx)"])
  assert.equal(entry.rules["storybook/default-exports"], "error")
  assert.equal(entry.rules["react/no-multi-comp"], "off")
  assert.equal(entry.rules["max-lines-per-function"], "off")
  assert.ok(
    Object.keys(entry.rules).every(
      (r) => !r.includes("/") || /^(storybook|react-hooks|react)\//.test(r),
    ),
  )
})
