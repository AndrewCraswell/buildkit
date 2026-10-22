# Selecting a component style

Install one generated Base UI style under the kit's stable package name:

```sh
pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-vega
pnpm add @buildkitgg/shadcn-modals-manager @buildkitgg/shadcn-alerts-manager
```

```tsx
import { Button } from "@buildkitgg/shadcn-baseui-kit"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import { createModalManager } from "@buildkitgg/shadcn-modals-manager"

export const modals = createModalManager()
```

The app and both managers resolve the same installed component package. No renderer adapter, theme prop, runtime
provider, or bundler alias is needed. The managers declare the kit as a peer dependency and leave its imports external.
Import the kit stylesheet once; manager stylesheets also resolve that same peer's no-reset stylesheet.

Select another style by replacing the dependency alias. Install the alias in each app that consumes the managers, not
only at the monorepo root. Use compatible versions for the style package and managers. The kit name is only the shared
alias; always select a named style package.

Styles are generated from the upstream catalog. They change layout and component classes as well as appearance; they are
not interchangeable color palettes. Light/dark mode and brand colors remain CSS-variable overrides. This mechanism
selects one Base UI implementation per app. It does not automatically discover components copied from the registry, or
switch between Radix and Base UI.

## Updating upstream

Run these commands from the repository root:

```sh
pnpm update:shadcn
pnpm generate
pnpm validate
```

`update:shadcn` downloads a pinned Git commit and updates the shadcn generator and Base UI dependencies. The snapshot
records the revision and SHA-256 hashes of the downloaded files. `generate` derives style packages, exports, component
source, and stylesheets from that snapshot. Builds do not access the network or alter upstream component behavior.

`validate` runs repository verification, including API Extractor baselines, then compares every generated declaration
across styles and installs packed artifacts in standalone consumers. Consumers check strict peer resolution, TypeScript,
server rendering, and a Vite production build. Browser acceptance remains necessary for visual changes.

If upstream introduces an import outside the supported catalog or an incompatible public API, generation or validation
fails. Review the change; do not add a silent fallback. `pnpm api:update` explicitly accepts reviewed API baseline
changes. The weekly updater never calls that command automatically.

All style packages come from one source snapshot. Generated files in `.generated` and `dist` are disposable; do not edit
them. The updater owns the generated package metadata; Beachball owns versions and changelogs.

## Reading default tokens from a CLI

The alias applies to asset exports as well as components:

```ts
import { readFile } from "node:fs/promises"
const url = import.meta.resolve("@buildkitgg/shadcn-baseui-kit/tokens.json")
const tokens = JSON.parse(await readFile(new URL(url), "utf8"))
```

The JSON contains `schemaVersion`, `style`, `upstream`, `palette`, `light`, and `dark`. Each token has a `resolvedValue`
and its original `sourceValue`. Dimensions resolve to pixels at the recorded `rootFontSize` (16px for the published
defaults). Colors resolve to sRGB hex or RGBA literals, preserving alpha; wide-gamut originals remain in `sourceValue`.
It is generated from the same upstream data as the CSS. These are package defaults, not computed values after app CSS
overrides. Component utility classes are not invented into a second token system.

## Weekly updates

The weekly GitHub workflow runs on Monday. It updates, regenerates, checks the committed API baselines, prepares
Beachball patch versions, and runs `pnpm validate`. Compatible updates are committed with a normal fast-forward push and
dispatch the existing trusted-publishing workflow. It never force-pushes or bypasses branch protection.

Failed updates open a review PR. API changes require review and an explicit `pnpm api:update`; API-compatible visual
changes can still need manual assessment. If main disallows bot pushes, the review PR must be merged before publishing.
New npm package names require their initial publication and trusted-publisher setup; the workflow cannot authorize those
automatically. Existing npm environment approvals remain in effect.
