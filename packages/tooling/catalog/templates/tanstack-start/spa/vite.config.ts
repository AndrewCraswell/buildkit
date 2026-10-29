import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { vitePlugins } from "./src/generated/buildkit/config"

// Add-ons' plugins come in bands: `pre` first, then `framework`, such as the Better Apps plugin, before Start and
// React, then `post`. To change one, replace its entry from vitePluginsById here instead of editing the generated file.
export default defineConfig({
  plugins: [
    ...vitePlugins.pre,
    ...vitePlugins.framework,
    tanstackStart({
      router: { quoteStyle: "double", semicolons: false },
      // Every page is served from one prerendered shell. /index.html is where static hosts look for an SPA's fallback.
      spa: { enabled: true, prerender: { outputPath: "/index.html" } }
    }),
    react({ compiler: true }),
    ...vitePlugins.post
  ]
})
