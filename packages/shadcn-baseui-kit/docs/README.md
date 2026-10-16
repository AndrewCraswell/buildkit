# Maintenance

- [Package usage](../README.md)
- [Upstream inventory](../upstream.json)
- [Theming and stylesheet options](theming.md)
- [Framework integration](integration.md)
- [Releases and version policy](releasing.md)
- [Changelog](../CHANGELOG.md)

Components are vendored from shadcn/ui's base-nova registry under its MIT license. Preserve the copyright notice. Update
the catalog centrally, never during a consumer install. Fetch with the pinned shadcn CLI into a staging directory,
review dependency and API changes, adapt relative ESM imports and file names, update the root exports and upstream
inventory, then verify before replacing a release. Keep source changes reviewable against upstream.

Run the package build, interaction tests, lint and type checks, then the repository's pnpm verify. Use pnpm preview for
desktop/mobile and keyboard acceptance. Before release, pack and install into a separate consumer, verify the
declarations and compiled stylesheet, and confirm no TSX, source maps, preview files or tests are packed. Keep the
package private until npm ownership and release credentials are confirmed.

The test coverage gate measures the Button/Dialog/Tabs interaction slice; it does not claim complete behavioral coverage
of the upstream catalog. Upstream assertions, memoization and polymorphic render patterns are retained where needed for
API compatibility.

Scoped lint exceptions preserve upstream polymorphic roles and caller-supplied label associations. Input-group clicks
only forward focus to the already keyboard-accessible input; code blocks are focusable for keyboard scrolling. Carousel
and mobile hooks synchronize external browser APIs. Calendar accepts component overrides through its documented
components prop.

## Component workshop

The Storybook catalog lives in `stories/catalog.stories.tsx` with one named story for each source-bearing upstream
component. Keep new catalog entries paired with a composed, usable story. Shared main and preview settings come from
`@repo/storybook-config`; the local preview adds theme, viewport, error-boundary and tooltip context. The existing Vite
React Compiler configuration also applies to Storybook. Story files are outside src and are not published.
