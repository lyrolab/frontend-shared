import assert from "node:assert/strict"
import { test } from "node:test"

import { defineConfig } from "@playwright/test"

const loadPreset = async (ci) => {
  const previous = process.env.CI
  if (ci) process.env.CI = "true"
  else delete process.env.CI
  try {
    const { lyrolabPlaywright } = await import(
      `../src/playwright/index.js?ci=${ci}`
    )
    return lyrolabPlaywright
  } finally {
    if (previous === undefined) delete process.env.CI
    else process.env.CI = previous
  }
}

test("CI defaults: strict, retried, two workers, github reporter", async () => {
  const config = await loadPreset(true)
  assert.equal(config.forbidOnly, true)
  assert.equal(config.retries, 2)
  assert.equal(config.workers, 2)
  assert.equal(config.updateSnapshots, "none")
  assert.deepEqual(config.reporter, [
    ["list"],
    ["html", { open: "never" }],
    ["github"],
  ])
})

test("local defaults: no retries, capped workers, no github reporter", async () => {
  const config = await loadPreset(false)
  assert.equal(config.forbidOnly, false)
  assert.equal(config.retries, 0)
  assert.equal(config.workers, 4)
  assert.equal(config.updateSnapshots, "default")
  assert.deepEqual(config.reporter, [["list"], ["html", { open: "never" }]])
})

test("screenshot, snapshot path and browser defaults", async () => {
  const config = await loadPreset(false)
  assert.equal(
    config.snapshotPathTemplate,
    "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  )
  assert.deepEqual(config.expect.toHaveScreenshot, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: 100,
    threshold: 0.2,
  })
  assert.deepEqual(config.use, {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
  })
  const [setup, chromium] = config.projects
  assert.equal(setup.name, "setup")
  assert.ok(setup.testMatch.test("e2e/setup/auth.setup.ts"))
  assert.equal(chromium.name, "chromium")
  assert.deepEqual(chromium.dependencies, ["setup"])
  assert.equal(chromium.use.defaultBrowserType, "chromium")
  assert.deepEqual(chromium.use.viewport, { width: 1280, height: 800 })
})

test("defineConfig merges consumer overrides onto the preset", async () => {
  const preset = await loadPreset(false)
  const config = defineConfig(preset, {
    use: { baseURL: "http://localhost:3000" },
    projects: [{ name: "chromium", testMatch: /specs\/.*\.spec\.ts/ }],
  })
  assert.equal(config.use.baseURL, "http://localhost:3000")
  assert.equal(config.use.locale, "en-US")
  const chromium = config.projects.find((p) => p.name === "chromium")
  assert.deepEqual(chromium.dependencies, ["setup"])
  assert.deepEqual(chromium.use.viewport, { width: 1280, height: 800 })
  assert.equal(config.projects.length, 2)
})
