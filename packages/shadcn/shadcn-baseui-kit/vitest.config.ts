import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/ui/Button.tsx", "src/components/ui/Dialog.tsx", "src/components/ui/Tabs.tsx"],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 }
    }
  }
})
