# @buildkitgg/fluentui-theme

Fluent UI v9 themes backed by Buildkit's framework-independent theme and preferences stores.

```tsx
import { createFluentTheme, FluentThemeProvider, useTheme } from "@buildkitgg/fluentui-theme"

export const theme = createFluentTheme({
  defaultTheme: "system", // Default; use "dark" for a dark-first app.
  storageKey: "my-app-theme", // Omit for memory-only selection.
  storage: "localStorage" // Or "sessionStorage".
})

export function App() {
  return (
    <FluentThemeProvider store={theme}>
      <Settings />
    </FluentThemeProvider>
  )
}
function Settings() {
  const { theme: selection, setTheme } = useTheme(theme)
  return <button onClick={() => setTheme("dark")}>{selection}</button>
}
// Ordinary TypeScript can use the same store:
theme.setTheme("light")
theme.reset()
```

Install React 19, React DOM 19 and `@fluentui/react-components` v9 as peers. FluentProvider is still required for Fluent
styling, context and portals. This package supplies it; the selection store and hook do not require React context.
Provider props such as `dir`, `targetDocument`, `className` and `ref` pass through.

## Custom themes

Pass complete Fluent `Theme` objects as `lightTheme` and `darkTheme`. Use Fluent's `createLightTheme(brand)` /
`createDarkTheme(brand)`, or spread `webLightTheme` / `webDarkTheme` and override tokens. Each side defaults
independently to Fluent's web theme. These token objects are not persisted; only selection is stored.

## Lifecycle and server rendering

Provider mounting connects system appearance and optional storage; unmounting disconnects them. Multiple providers can
share a store, including React Strict Mode. Outside React call `const stop = theme.start()` and call `stop()` when done.
Calls are reference-counted and cleanup is idempotent. No document-wide CSS classes are changed.

Create a separate store per server request. `systemTheme` supplies the initial server resolution (light by default).
Browser preferences are restored after mount; an appearance change is possible on hydration. Match server/client initial
options; use a known request preference for first-paint consistency. In another window pass its `window` to the factory
and `targetDocument` to the provider.

Use `theme.reset()` (or `reset` from `useTheme`) to clear the saved selection and restore `defaultTheme`. Reset
synchronizes across tabs when localStorage is enabled. Persistence is internal; consumers use only the theme API.

Examples: `pnpm --filter @buildkitgg/behavior-storybook storybook`.
