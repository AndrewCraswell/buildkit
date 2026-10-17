# @buildkitgg/theme-core

Framework-independent theme state with stable, immutable snapshots. No React dependency, DOM access, or shared global
store at the root entry. Private while the API is being developed.

```ts
import { createThemeStore, type Theme } from "@buildkitgg/theme-core"

const theme = createThemeStore() // defaults to system, with light as the server fallback
const preference: Theme = "dark"
theme.setTheme(preference)
const unsubscribe = theme.subscribe(() => savePreview(theme.getSnapshot()))
```

`Theme` is `"system" | "light" | "dark"`; `ResolvedTheme` is `"light" | "dark"`. `getSnapshot()` returns a readonly
`{ theme, resolvedTheme }` object whose identity changes only when its values change. Every exported API ships ESM and
TypeScript declarations. `ThemeStore`, `ThemeOptions`, and `ThemeSnapshot` are exported types.

Set `defaultTheme: "dark"` for apps that prefer dark mode. `systemTheme` supplies the initial system/server fallback.
`setSystemTheme` updates the system input without overriding an explicit user preference. `getServerSnapshot()` always
returns the construction-time snapshot; create a separate store per server request when using user-specific defaults.

## Optional browser integration

```ts
import { connectBrowserTheme } from "@buildkitgg/theme-core/browser"

const disconnect = connectBrowserTheme(theme, { storageKey: "my-app-theme" })
// Call disconnect() when the app unmounts.
```

Call once per store at browser startup. This follows device changes and synchronizes saved preferences across tabs. Omit
`storageKey` for memory-only preferences. Set `storage: "sessionStorage"` to keep choices within a browser tab instead.
A valid stored choice wins over the app default. Malformed JSON and basic type mismatches are ignored; removal or clear
restores the app default. Unknown theme strings resolve to the app default. Storage failures leave the store usable in
memory. No DOM classes or UI styling are applied by this adapter. It is a no-op without a browser.

`theme.reset()` removes the user's selection and restores the configured `defaultTheme` (system unless overridden). When
connected to browser storage, reset removes the saved override and synchronizes to other tabs. Choosing
`setTheme("system")` is an explicit selection; reset instead returns control to the application's default. Persistence
is internal and is not exposed through the theme store.

[Maintenance](docs/README.md)
