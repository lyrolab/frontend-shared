import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/auth/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/vitest-setup.ts"],
  },
})
