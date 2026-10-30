import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, lazyPlugins } from "vite-plus"

export default defineConfig(({ command }) => {
  const base = process.env.PAGES_BASE ?? "/"
  return {
    base,
    plugins: lazyPlugins(() => [react({ compiler: true }), tailwindcss()]),
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    define: {
      __DOCS_URL__: JSON.stringify(command === "serve" ? "http://127.0.0.1:4180/docs/" : `${base}docs/`),
      __STORYBOOK_URL__: JSON.stringify(command === "serve" ? "http://127.0.0.1:6009/" : `${base}storybook/`)
    }
  }
})
