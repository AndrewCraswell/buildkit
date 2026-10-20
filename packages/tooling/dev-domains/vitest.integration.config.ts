import { defineConfig } from "vitest/config"
export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-integration-cache",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false
  }
})
