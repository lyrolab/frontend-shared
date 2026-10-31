import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"

import createConfig from "../src/oxlint/index.js"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const presetUrl = new URL("../src/oxlint/index.js", import.meta.url).href

const restriction = (override) => override.rules["no-restricted-imports"]

test("returns one Oxlint config object", () => {
  const config = createConfig()
  assert.equal(typeof config, "object")
  assert.ok(config.rules["react/rules-of-hooks"])
  assert.equal(config.categories.correctness, "error")
})

test("React Query hooks are restricted by default", () => {
  const rule = createConfig().rules["no-restricted-imports"]
  assert.equal(rule[0], "error")
  const names = rule[1].paths.flatMap((p) => p.importNames ?? [])
  assert.ok(names.includes("useSuspenseQuery"))
})

test("data dirs exempt React Query but keep wrapper restrictions", () => {
  const config = createConfig({
    dataQueryDirs: ["data/queries"],
    restrictedWrapperImports: [
      { name: "posthog-js", allowedDir: "modules/analytics" },
    ],
  })
  const data = config.overrides.find((o) => o.files[0] === "**/data/queries/**")
  const pathNames = restriction(data)[1].paths.map((p) => p.name)
  assert.ok(!pathNames.includes("@tanstack/react-query"))
  assert.ok(pathNames.includes("posthog-js"))
})

test("type-aware rules are opt-in", () => {
  assert.equal(createConfig().options, undefined)
  assert.equal(
    createConfig().rules["typescript/no-floating-promises"],
    undefined,
  )
  const typed = createConfig({ typeChecked: true })
  assert.deepEqual(typed.options, { typeAware: true })
  assert.equal(typed.rules["typescript/no-floating-promises"], "error")
})

test("maxLinesPerFunction: false drops the rule", () => {
  const config = createConfig({ maxLinesPerFunction: false })
  assert.equal(config.rules["max-lines-per-function"], undefined)
})

test("overrides are appended last", () => {
  const extra = { files: ["src/legacy/**"], rules: { "no-empty": "off" } }
  assert.equal(createConfig({ overrides: [extra] }).overrides.at(-1), extra)
})

let dir

const lint = (options) => {
  const config = join(
    dir,
    `oxlint.${Math.random().toString(36).slice(2)}.config.mjs`,
  )
  writeFileSync(
    config,
    `import preset from ${JSON.stringify(presetUrl)}\nexport default preset(${options})\n`,
  )
  const res = spawnSync(
    join(repoRoot, "node_modules/.bin/oxlint"),
    ["--config", config, "--format", "json", "src"],
    { cwd: dir, encoding: "utf8" },
  )
  assert.ok(res.status === 0 || res.status === 1, res.stderr)
  const { diagnostics } = JSON.parse(res.stdout)
  return (file) =>
    diagnostics.filter((d) => d.filename.endsWith(file)).map((d) => d.code)
}

before(() => {
  // Oxlint matches override globs against the config path, so both must be real paths.
  dir = realpathSync(mkdtempSync(join(tmpdir(), "oxlint-preset-")))
  mkdirSync(join(dir, "src/data/queries"), { recursive: true })
  mkdirSync(join(dir, "src/components"), { recursive: true })
  writeFileSync(
    join(dir, "src/components/Posts.tsx"),
    `import { useQuery } from "@tanstack/react-query"

export function Posts({ id }: { id: string }) {
  const posts = useQuery({ queryKey: ["posts"], queryFn: () => fetch(id) })
  return <p>{String(posts.data)}</p>
}

export function Extra() {
  return <p />
}
`,
  )
  writeFileSync(
    join(dir, "src/data/queries/posts.ts"),
    `import { useQuery } from "@tanstack/react-query"
import { Posts } from "../../components/Posts"

export const usePosts = () => useQuery({ queryKey: ["posts"], queryFn: () => String(Posts) })
`,
  )
  writeFileSync(
    join(dir, "src/name.ts"),
    `export const name = "Acme"
`,
  )
})

after(() => rmSync(dir, { recursive: true, force: true }))

test("oxlint enforces the layering, React and Query rules", () => {
  const codes = lint("{}")
  assert.deepEqual(codes("components/Posts.tsx").sort(), [
    "@tanstack/query(exhaustive-deps)",
    "eslint(no-restricted-imports)",
    "react(no-multi-comp)",
  ])
  assert.deepEqual(codes("data/queries/posts.ts"), [
    "eslint(no-restricted-imports)",
  ])
})

test("lyrolab/restricted-syntax reports selector matches", () => {
  const codes = lint(`{
    overrides: [{
      files: ["src/name.ts"],
      rules: { "lyrolab/restricted-syntax": ["error", { selector: "Literal[value='Acme']", message: "No" }] },
    }],
  }`)
  assert.deepEqual(codes("name.ts"), ["lyrolab(restricted-syntax)"])
})
