import { fileURLToPath } from "node:url"
import { defineConfig } from "vite-plus"

export default defineConfig({
  resolve: {
    // Workers provide `cloudflare:workers`; Node tests use the stand-in in test/cloudflare-workers.ts.
    alias: { "cloudflare:workers": fileURLToPath(new URL("test/cloudflare-workers.ts", import.meta.url)) }
  },
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 75 }
    }
  }
})
