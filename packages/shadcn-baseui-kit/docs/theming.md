# Theming

[Documentation](README.md)

Import one package stylesheet before your application's theme CSS. Defaults remain for tokens you do not override. Use
unlayered `:root` and `:root.dark` rules after the package import for reliable overrides.

| Group             | Variables                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page              | `--background`, `--foreground`                                                                                                                                                    |
| Surfaces          | `--card`, `--card-foreground`, `--popover`, `--popover-foreground`                                                                                                                |
| Actions           | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`                                                                                                      |
| Supporting colors | `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`                                                                                               |
| Controls          | `--border`, `--input`, `--ring`                                                                                                                                                   |
| Shape             | `--radius` (a CSS length)                                                                                                                                                         |
| Charts            | `--chart-1` through `--chart-5`                                                                                                                                                   |
| Sidebar           | `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` |

Colors accept complete CSS color values such as hex, `rgb()`, or `oklch()`, not bare HSL channel lists. Set foreground
tokens alongside their background tokens and check contrast for your chosen colors. Related tokens are independent:
changing `--primary` does not automatically change `--sidebar-primary` or chart colors.

## Dark mode and fonts

Toggle `document.documentElement.classList.toggle("dark", isDark)` in client code. If the app persists the preference,
apply it before first paint to avoid a theme flash. In server-rendered apps, prefer a server-readable preference so
server and client markup agree. Theme selection is the application's responsibility; no theme provider is required for
the core component styles. Sonner's theme prop or its `next-themes` integration should match the selected mode.

Set fonts on `body` and load font files in your app. Override `--font-sans` and `--font-mono` for utility-based text.
Apply brand tokens and `.dark` to `<html>`; styling only an application wrapper does not theme portals mounted outside
it. Multiple independently themed regions require deliberate portal-container handling.

## An app that already uses Tailwind 4

Let the app own Preflight and use the package's no-reset stylesheet. For example, in your app's global CSS:

```css
@import "tailwindcss";
@import "@buildkitgg/shadcn-baseui-kit/styles-no-reset.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-border: var(--border);
}

:root {
  --primary: #6d28d9;
  --primary-foreground: #fff;
}

@layer base {
  body {
    background: var(--background);
    color: var(--foreground);
  }
}
```

Register the token mappings your app wants to use as utilities; the package CSS is already compiled, so its original
`@theme` declarations do not register utilities in your build. You do not need to scan package source. The package and
app use standard unprefixed Tailwind class names, so conflicting utility definitions share the cascade. Tailwind 3
coexistence is not verified; prefer Tailwind 4 or plain application CSS.

The no-reset entry follows Tailwind's
[partial import pattern](https://tailwindcss.com/docs/preflight#disabling-preflight). It is intended for a compatible
app reset, not for reproducing the default appearance with browser defaults alone.
