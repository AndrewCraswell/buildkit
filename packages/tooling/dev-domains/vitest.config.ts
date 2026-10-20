import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/main.ts"],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 75 }
    }
  }
})
