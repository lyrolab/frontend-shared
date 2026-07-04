import assert from "node:assert/strict"
import { test } from "node:test"

import { lyrolabFrontend } from "../src/eslint/index.js"

// The base (all-files) group is the one that also declares the react-hooks rules.
const baseGroup = (config) =>
  config.find((c) => c.rules?.["react-hooks/rules-of-hooks"])

test("returns a non-empty flat config array", () => {
  const config = lyrolabFrontend()
  assert.ok(Array.isArray(config))
  assert.ok(config.length > 0)
})

test("react-hooks rules are enforced", () => {
  const config = lyrolabFrontend()
  const base = config.find((c) => c.rules?.["react-hooks/rules-of-hooks"])
  assert.equal(base.rules["react-hooks/rules-of-hooks"], "error")
  assert.equal(base.rules["react-hooks/exhaustive-deps"], "warn")
  assert.equal(base.rules["react/no-multi-comp"][0], "error")
})

test("React Query hooks are restricted by default", () => {
  const config = lyrolabFrontend()
  const rule = baseGroup(config).rules["no-restricted-imports"]
  assert.equal(rule[0], "error")
  const names = rule[1].paths.flatMap((p) => p.importNames ?? [])
  assert.ok(names.includes("useSuspenseQuery"))
})

test("data/queries dir exempts React Query but keeps other restrictions", () => {
  const config = lyrolabFrontend({
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
  const config = lyrolabFrontend({
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
  const config = lyrolabFrontend({ dataQueryDirs: ["queries"] })
  const dqEntry = config.find((c) => c.files?.[0] === "**/queries/**")
  const patterns = dqEntry.rules["no-restricted-imports"][1].patterns
  const groups = patterns.flatMap((p) => p.group)
  assert.ok(groups.includes("**/components/**"))
  assert.ok(groups.includes("**/pages/**"))
})

test("max-lines-per-function is a warn at the configured threshold", () => {
  const base = baseGroup(lyrolabFrontend())
  const rule = base.rules["max-lines-per-function"]
  assert.equal(rule[0], "warn")
  assert.equal(rule[1].max, 150)

  const custom = baseGroup(lyrolabFrontend({ maxLinesPerFunction: 200 }))
  assert.equal(custom.rules["max-lines-per-function"][1].max, 200)
})

test("max-lines-per-function can be disabled", () => {
  const base = baseGroup(lyrolabFrontend({ maxLinesPerFunction: false }))
  assert.equal(base.rules["max-lines-per-function"], undefined)
})

test("typeChecked adds parserOptions.projectService", () => {
  const config = lyrolabFrontend({ typeChecked: true })
  const tc = config.find(
    (c) => c.languageOptions?.parserOptions?.projectService,
  )
  assert.ok(tc)
})
