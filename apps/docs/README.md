# Reference documentation

VitePress renders package READMEs and API Documenter output. API models are produced by API Extractor.

From the repository root, run `pnpm check:api`, `pnpm --filter @buildkitgg/docs generate`, then
`pnpm --filter @buildkitgg/docs dev`. Open `/docs/` at the printed server address. Generation invokes the official API
Documenter CLI separately for each typed entry point, preserving its package/subpath identity without inventing npm
package names. Cross-entry links are provided by generated navigation; individual symbol links stay within that entry.

`pnpm --filter @buildkitgg/docs build` generates content and builds the site. Root `pnpm verify` runs extraction before
the build. Guides and references are generated and ignored by Git; edit package READMEs and TSDoc comments instead.
`content/index.md`, `content/routing/index.md`, and theme configuration are authored. Local full-text search is built
in. The dev-domains CLI reference lives within that package’s navigation and is linked from its guide. It reads compiled
command definitions without invoking commands or importing the CLI entry point.

`navigation.ts` owns the documentation grouping for the sidebar and generated guide/API indexes. Routing groups Core,
React bindings, React Router, and TanStack Router together; package names and architectural layers remain unchanged.

The Pages workflow publishes `dist/site` under `/docs/` beside the landing page and Storybook. Set `PAGES_BASE` to the
deployment base path for project Pages hosting. VitePress and Microsoft's tools are development dependencies only.
