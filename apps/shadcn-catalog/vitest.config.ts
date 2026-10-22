import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "../../packages/shadcn/shadcn-baseui-nova/dist/ui/button.js",
        "../../packages/shadcn/shadcn-baseui-nova/dist/ui/dialog.js",
        "../../packages/shadcn/shadcn-baseui-nova/dist/ui/tabs.js"
      ],
      thresholds: { lines: 70, functions: 70, statements: 70, branches: 60 }
    }
  }
})
