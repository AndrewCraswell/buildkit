# Buildkit.gg

React marketing page for GitHub Pages, built with Vite, the React Compiler, and TypeScript. Run
`pnpm --filter @buildkitgg/site dev` and open the printed URL. Storybook links use the local Storybook server during
development (`pnpm --filter @buildkitgg/behavior-storybook storybook`).

The build reuses the Storybook package catalog and overview-ID helper. Package names, descriptions, and navigation have
one source. No package versions or publishing states are displayed. The production build prerenders the React page to
HTML, then hydrates it for the interactive examples, code tabs, mobile navigation, and package search. Guides and
package links remain available without JavaScript. No external fonts, trackers, or hosted services are required.

## Components and theme

The marketing surface uses the official [shadcn Vega style](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
with Base UI primitives. Button, Input, Tabs, and Dialog are adapted from `https://ui.shadcn.com/r/styles/base-vega/`;
their MIT notice is included in `public/shadcn-license.txt`. `components.json` records the style for future additions.
The shared component package retains its own style; these Vega components belong to the marketing app.

`src/theme.css` defines the blue semantic tokens. Vite’s Tailwind integration compiles component classes and page CSS,
including updates during development. The theme example uses `theme-core` and `react-theme`, isolated from the page
theme and without persistence. The preferences example uses `preferences-core` and `react-preferences` for a saved
reading text size. It connects browser storage after hydration through `connectPreferencesStorage`, with cleanup for
StrictMode and unmounting. The isolated `buildkit-reading-demo` local storage key survives reloads and synchronizes
across tabs; reset removes the saved override. The modal examples use `shadcn-modals-manager` with the site's Vega
components through `baseUiComponents`. Focused tabs demonstrate boolean confirmations, typed form results, failed saves
with retry, and nested confirmations before discarding edits. All changes stay in local demo state; the save-and-retry
example simulates a request without contacting a server.

Keep the main copy focused on common app behavior and the architecture, rather than listing the current package set.
Package discovery belongs in the generated catalog. Demonstrations use the real packages and link to their guides.

The production build first bundles the browser app, then renders the same `Page` component through a temporary server
bundle in `.generated/server`. Only `dist` is deployed; GitHub Pages needs no Node server.

`PAGES_BASE` defaults to `/` for buildkit.gg and can be set to `/buildkit/` for the repository's default Pages URL.
Production Storybook files must be copied into `dist/storybook` and reference docs into `dist/docs` before uploading the
Pages artifact. The Pages workflow does this after both builds succeed. See [website operations](../../docs/website.md).
