import { defineConfig } from "vite-plus"
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    // The temp-folder tests are fast, so they run here too; CI also runs them on Windows and macOS.
    exclude: ["**/node_modules/**", "**/dist/**"],
    // On a busy Windows machine, apply waits out file locks for seconds at a time, so a test of several commands can
    // pass 5 seconds without anything being wrong.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**"],
      thresholds: { statements: 85, lines: 85, functions: 85, branches: 75 }
    }
  }
})
