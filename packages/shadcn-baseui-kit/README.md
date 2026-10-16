# @buildkitgg/shadcn-baseui-kit

The shadcn Base UI component library, packaged and maintained. Import components from one package instead of connecting
each application to the registry or maintaining copied component source.

Includes all 64 source-bearing components in the pinned **base-nova** catalog, with their composition parts exported
from the root. This is an independent MIT-licensed distribution, not an official shadcn or Base UI package.

## Install

```sh
pnpm add @buildkitgg/shadcn-baseui-kit react react-dom
```

For local development, use `workspace:*` inside this monorepo or install a tarball produced by
`pnpm --filter @buildkitgg/shadcn-baseui-kit pack`.

Requires React and React DOM 19.2 or later within version 19, an ESM-capable bundler, and a modern browser supporting
Tailwind CSS 4 features. No Tailwind installation, shadcn CLI, `components.json`, or registry connection is required by
the consuming app.

## Quick start

Import the stylesheet once at your application entry point:

```tsx
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import { Button, Card, CardContent } from "@buildkitgg/shadcn-baseui-kit"

export function Welcome() {
  return (
    <Card>
      <CardContent>
        <Button>Continue</Button>
      </CardContent>
    </Card>
  )
}
```

For Vite, put the CSS import in `src/main.tsx`. For Next.js App Router, put it in `app/layout.tsx`. Use a client
component for event handlers and interactive compositions. See [framework integration](docs/integration.md).

## Choose a stylesheet

Import **one** stylesheet:

| Import                                              | Use when                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@buildkitgg/shadcn-baseui-kit/styles.css`          | The package should provide Tailwind Preflight, page colors, and base border styles.   |
| `@buildkitgg/shadcn-baseui-kit/styles-no-reset.css` | Your app already provides its reset and page styles, including apps using Tailwind 4. |

Both include compiled component utilities, animations, and default theme variables. The no-reset version omits Preflight
and the package's universal border/outline and body color rules. It still defines global theme variables and utility
classes; it is not CSS isolation. Components expect compatible base styles such as border-box sizing and normalized form
controls. Arbitrary resets may require adjustments.

## Custom themes

Import your theme after the package stylesheet. Override standard shadcn CSS variables; no package rebuild is needed:

```css
/* theme.css */
:root {
  --primary: #6d28d9;
  --primary-foreground: #ffffff;
  --ring: #7c3aed;
  --radius: 0.75rem;
}

:root.dark {
  --primary: #c4b5fd;
  --primary-foreground: #2e1065;
  --ring: #a78bfa;
}
```

Apply the `dark` class to `<html>` so dialogs and other portaled content inherit the theme. The application owns theme
selection, persistence, and font loading. [Theming](docs/theming.md) covers token groups and existing Tailwind apps.

## Base UI composition

These components use Base UI's `render` composition rather than Radix's `asChild` pattern:

```tsx
"use client"

import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@buildkitgg/shadcn-baseui-kit"

export function Details() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>View details</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project details</DialogTitle>
          <DialogDescription>Everything you need to get started.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
```

Keep accessible labels and descriptions in your application compositions. Tooltips need `TooltipProvider`. Notifications
use `Toaster` with `toast`; the alternative `SonnerToaster` uses the `sonner` API. Install libraries you import directly
as your app's dependencies instead of relying on transitive dependencies.

## Scope and tradeoffs

- See [the upstream inventory](upstream.json) for the pinned catalog. Data Table, Date Picker, and Typography are
  recipes composed from exported primitives. The upstream `form` entry has no source files. Blocks and the separate AI
  Elements registry are outside this package's scope.
- JavaScript is compiled ESM and can be tree-shaken. Each stylesheet includes the entire component catalog.
- The root is a React client boundary. Props crossing a Server Component boundary must be serializable.
- Component `className` and `style` props remain available. New Tailwind utility classes need the app's own build.
- Published files include JavaScript, type declarations, CSS, documentation, and license notices. TSX source, source
  maps, tests, and preview code are excluded. This centralizes maintenance; it cannot prevent consumers from patching
  their installed dependencies.

## Explore and contribute

Run `pnpm --filter @buildkitgg/shadcn-baseui-kit storybook` in this repository, then open
[Storybook](http://127.0.0.1:6008). It contains all 64 examples with light/dark and mobile previews. A static build is
available through `pnpm --filter @buildkitgg/shadcn-baseui-kit build-storybook`.

- [Documentation and maintenance](docs/README.md)
- [Release checklist and version policy](docs/releasing.md)
- [Changelog](CHANGELOG.md)
- [Report an issue](https://github.com/AndrewCraswell/buildkit/issues)
- [MIT license](LICENSE)
