import { defineConfig } from "vite-plus"
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    // The temp-folder tests are fast, so they run here too; CI also runs them on Windows and macOS.
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/bin.ts"],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 75 }
    }
  }
})
