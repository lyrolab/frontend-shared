import { devices } from "@playwright/test"

const ci = !!process.env.CI

const reporter = [["list"], ["html", { open: "never" }]]

export const lyrolabPlaywright = {
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  updateSnapshots: ci ? "none" : "default",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 2 : 0,
  // Each worker signs in as its own account; raise only as far as the account pool allows.
  workers: ci ? 2 : 4,
  reporter: ci ? [...reporter, ["github"]] : reporter,
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
    serviceWorkers: "block",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ["setup"],
    },
  ],
}

export default lyrolabPlaywright
