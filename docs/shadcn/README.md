# shadcn Base UI styles

The shadcn Base UI component library, packaged and maintained. Import components from one package instead of connecting
each application to the registry or maintaining copied component source.

Choose an upstream style at installation time. Each style includes the pinned Base UI catalog, with composition parts
exported from the root. This is an independent MIT-licensed distribution, not an official shadcn or Base UI package.

[Migrating from the retired standalone kit](migration.md).

## Install

```sh
pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-vega react react-dom
```

This installs Vega under the stable `@buildkitgg/shadcn-baseui-kit` import name. It does **not** install a second kit
package. Replace `vega` with your selected style; application imports stay unchanged.

```json
{
  "dependencies": {
    "@buildkitgg/shadcn-baseui-kit": "npm:@buildkitgg/shadcn-baseui-vega@<version>"
  }
}
```

Let the install command write the actual version. Buildkit's shadcn modal and alert managers use this same peer
dependency, so they inherit the app's selection without adapters or theme props. Install the alias in the application
that consumes those managers.

`@buildkitgg/shadcn-baseui-kit` is the shared alias/import name. Select one of the style packages below; there is no
separate kit to install.

[Luma](../../packages/shadcn/shadcn-baseui-luma/README.md), [Lyra](../../packages/shadcn/shadcn-baseui-lyra/README.md),
[Maia](../../packages/shadcn/shadcn-baseui-maia/README.md), [Mira](../../packages/shadcn/shadcn-baseui-mira/README.md),
[Nova](../../packages/shadcn/shadcn-baseui-nova/README.md), [Rhea](../../packages/shadcn/shadcn-baseui-rhea/README.md),
[Sera](../../packages/shadcn/shadcn-baseui-sera/README.md), [Vega](../../packages/shadcn/shadcn-baseui-vega/README.md).

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
component for event handlers and interactive compositions. See [framework integration](integration.md).

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

For Tailwind 4 apps, import `tailwindcss` and `@buildkitgg/shadcn-baseui-kit/tailwind.css` instead of either compiled
stylesheet. The source entry registers component scanning, tokens, variants, and animations automatically. Do not also
import manager stylesheets: they import compiled kit CSS. `theme.css` supplies only plain theme variables, not component
utilities. See [theming](theming.md).

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
selection, persistence, and font loading. [Theming](theming.md) covers token groups and existing Tailwind apps.

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

Use `ShadcnLocalizationProvider` for built-in labels and keep application content in your compositions. See
[localization and RTL](localization.md). Tooltips need `TooltipProvider`. Notifications use `Toaster` with `toast`; the
alternative `SonnerToaster` uses the `sonner` API. Install libraries you import directly as your app's dependencies
instead of relying on transitive dependencies.

## Scope and tradeoffs

- See [the upstream inventory](../../packages/shadcn/shadcn-baseui-nova/upstream.json) for the pinned catalog. Data
  Table, Date Picker, and Typography are recipes composed from exported primitives. The upstream `form` entry has no
  source files. Blocks and the separate AI Elements registry are outside this package's scope.
- JavaScript is compiled ESM and can be tree-shaken. Each stylesheet includes the entire component catalog.
- The root is a React client boundary. Props crossing a Server Component boundary must be serializable.
- Component `className` and `style` props remain available. New Tailwind utility classes need the app's own build.
- Published files include JavaScript, type declarations, CSS, documentation, and license notices. TSX source, source
  maps, tests, and preview code are excluded. This centralizes maintenance; it cannot prevent consumers from patching
  their installed dependencies.

## Explore and contribute

See the [upstream shadcn component documentation](https://ui.shadcn.com/docs/components) for individual components.
Buildkit Storybook documents style selection and manager integrations.

- [Documentation and maintenance](maintenance.md)
- [Release checklist and version policy](releasing.md)
- [Report an issue](https://github.com/AndrewCraswell/buildkit/issues)
- [MIT license](../../LICENSE)
