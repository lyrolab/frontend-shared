import type { PlaywrightTestConfig } from "@playwright/test"

/**
 * Shared Playwright Test defaults. Compose with `defineConfig(lyrolabPlaywright, { ... })`;
 * Playwright merges `use` and `expect` one level deep and `projects` by name.
 */
export declare const lyrolabPlaywright: PlaywrightTestConfig

export default lyrolabPlaywright
