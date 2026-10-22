import { defineMain } from "@repo/storybook-config/main"
import react from "@vitejs/plugin-react"
export default defineMain({
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: (config) => ({ ...config, plugins: [...(config.plugins ?? []), react({ compiler: true })] })
})
