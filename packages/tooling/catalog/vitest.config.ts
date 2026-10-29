import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    exclude: ["**/node_modules/**", "**/dist/**", "templates/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**"],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 75 }
    }
  }
})
