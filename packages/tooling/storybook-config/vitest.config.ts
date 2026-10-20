import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    coverage: {
      provider: "v8",
      include: ["utils/merge.ts"],
      thresholds: { statements: 100, lines: 100, functions: 100, branches: 90 }
    }
  }
})
