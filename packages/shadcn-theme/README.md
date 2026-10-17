# @buildkitgg/shadcn-theme

Theme state and document styling for shadcn apps. Private while the API is being developed. Works with the packaged Base
UI kit or an app's own shadcn components; no component-library or React runtime dependency is required.

```ts
// theme.ts
import { createShadcnTheme } from "@buildkitgg/shadcn-theme"

export const theme = createShadcnTheme({
  defaultTheme: "system", // optional; use "dark" or "light" to override
  storage: "localStorage", // optional; use "sessionStorage" for tab-local preferences
  storageKey: "my-app-theme" // optional; omit for memory-only selection
})
```

At browser startup, call `const stop = theme.start()`. This applies `.dark` and `color-scheme` to `<html>`, including
portaled dialogs and menus. Call `stop()` at teardown. Repeated starts on the same instance are reference counted; the
last cleanup removes listeners and restores the original class and color-scheme. Use one theme instance per document.
Construction has no browser side effects. Calling `start()` without a browser is harmless.

```tsx
import { useTheme } from "@buildkitgg/react-theme"
import { theme } from "./theme"

export function Appearance() {
  const { theme: preference, resolvedTheme, setTheme } = useTheme(theme)
  return <button onClick={() => setTheme("dark")}>Use dark theme ({resolvedTheme})</button>
}
```

Outside React, use `theme.setTheme("dark")` and `theme.getSnapshot()`. No theme provider is required. The React hook is
deliberately a separate package so future Fluent bindings can use the same store. All functions ship declarations;
`ShadcnThemeOptions` is exported and the returned store and hook types are inferred.

Import the component kit's stylesheet and supply any custom CSS tokens in your app. This package selects light/dark; it
does not ship palettes or change the component stylesheet. System is the default preference. A valid saved user
preference overrides `defaultTheme`; system changes affect appearance only when the preference is `"system"`.

## Server rendering and first paint

Use `theme.reset()` to clear the saved selection and restore `defaultTheme`. The React hook also returns `reset`.
Persistence is internal. Pass the same storage options to `getThemeInitScript` and the store.

Create stores per request if defaults depend on the user; do not mutate a server singleton for different users. Start
browser effects before client rendering or in the application shell's effect, with cleanup. Do not start them during
React render. Server and hydration options must agree.

For first-paint styling, `getThemeInitScript({ defaultTheme, storageKey })` returns a small script to insert in the
document head before content. Use the same options as the store and supply your CSP nonce. It handles blocked storage,
resolves system preference, and escapes configuration for embedding in HTML. It does not subscribe to changes; still
call `start()` on the client. In frameworks that hydrate `<html>`, account for this intentional class/style difference
at that element (for example, `suppressHydrationWarning` on the Next.js root html element).

[Maintenance](docs/README.md)
