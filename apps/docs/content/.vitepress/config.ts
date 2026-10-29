import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitepress"
import { documentationSections, packagePages, type PackageEntry } from "../../navigation.ts"

const catalogFile = new URL("../catalog.json", import.meta.url)
const catalog: PackageEntry[] = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")) : []
const base = `${process.env.PAGES_BASE ?? "/"}docs/`
const origin =
  process.env.PAGES_ORIGIN ?? (process.env.NODE_ENV === "production" ? "https://buildkit.gg" : "http://127.0.0.1:4178")
export default defineConfig({
  title: "Buildkit",
  description: "Package guides and generated TypeScript API reference.",
  base,
  outDir: fileURLToPath(new URL("../../dist/site", import.meta.url)),
  cleanUrls: true,
  lastUpdated: false,
  // The API reference has thousands of pages. Rendering 64 at once (the default) exhausts memory on Windows.
  buildConcurrency: 4,
  themeConfig: {
    logo: "/mark.svg",
    siteTitle: "Buildkit docs",
    nav: [
      { text: "Guides", link: "/packages/" },
      { text: "API reference", link: "/reference/" },
      {
        text: "Examples",
        link:
          process.env.NODE_ENV === "production"
            ? `${origin}${process.env.PAGES_BASE ?? "/"}storybook/`
            : "http://127.0.0.1:6009/"
      },
      { text: "Buildkit.gg", link: `${origin}${process.env.PAGES_BASE ?? "/"}` }
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/AndrewCraswell/buildkit" }],
    search: { provider: "local" },
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Introduction", link: "/" },
          { text: "API reference", link: "/reference/" }
        ]
      },
      ...documentationSections(catalog).map((section) => ({
        text: section.text,
        collapsed: false,
        items: [
          ...(section.link ? [{ text: "Overview", link: section.link }] : []),
          ...section.packages.map((pkg) => ({
            text: pkg.title,
            link: pkg.guide,
            collapsed: true,
            items: [
              ...packagePages(pkg.name),
              ...pkg.entries.map((entry) => ({
                text:
                  entry.name === `@buildkitgg/${pkg.name}`
                    ? "API reference"
                    : `${entry.name.slice(`@buildkitgg/${pkg.name}/`.length)} API reference`,
                link: entry.link
              }))
            ]
          }))
        ]
      }))
    ],
    footer: { message: "Released under the MIT license." },
    outline: [2, 3]
  },
  markdown: { attrs: { disable: true }, theme: { light: "github-light", dark: "github-dark" } }
})
