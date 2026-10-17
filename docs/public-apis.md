# Public behavior APIs

These contracts separate reusable state from framework and UI integration. Package root exports include declarations;
browser-only connections have explicit entry points. Public APIs do not expose the internal preferences store used by
theme packages.

| Package           | Consumer API                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| preferences-core  | `createPreferences<T>`, `get`, `set`, `reset`, `resetAll`, snapshots, subscriptions, JSON import/export, `dispose`             |
| react-preferences | `usePreferences(store)`, `usePreference(store, key)`                                                                           |
| theme-core        | `createThemeStore`, `setTheme`, `reset`, snapshots, subscriptions, `setSystemTheme` for environment adapters                   |
| react-theme       | `useTheme(store)` returning selection, resolved appearance, `setTheme`, and `reset`                                            |
| shadcn-theme      | `createShadcnTheme`, the theme store contract plus reference-counted `start`, and `getThemeInitScript`                         |
| fluentui-theme    | `createFluentTheme`, the theme store contract plus tokens and reference-counted `start`, `FluentThemeProvider`, and `useTheme` |

## Preferences

Infer key/value types from defaults or supply a generic for unions and keys without defaults. Defaults are partial;
reads can return undefined. Setters and reset accept only declared string keys. Reset removes an override rather than
recording a replacement. Values must be JSON-compatible; nested values are copied and frozen. Consumers replace values
through setters rather than mutating snapshots.

Storage is optional. Choosing localStorage or sessionStorage requires a nonempty key; a key without a storage mechanism
is rejected. Explicit browser connections return cleanup. Factory-owned connections are released by `dispose`.

JSON import is atomic and supports merge or replace. Exports contain overrides only. Generics are compile-time
contracts, not runtime schemas: imports check JSON compatibility and basic categories available from defaults, not
unions, unknown keys, or nested shapes. Import trusted configuration; domain adapters validate semantic values.

## Themes

Selection is `light | dark | system`; resolved appearance is `light | dark`. System is the default selection. Apps may
override `defaultTheme` and the initial `systemTheme`. Invalid initial themes and setter values throw. `reset()` clears
the persisted override and restores the configured default, including when the selected value already equals it.

Omit storageKey for memory-only selection. A storageKey enables localStorage by default; selecting sessionStorage also
requires a key. Browser effects belong to explicit connections or adapter `start()` calls. Fluent's provider manages
that connection automatically; it remains necessary for native Fluent styling and portals. UI dependencies are peers.

Create isolated stores per server request. Server snapshots retain the initial state; match initial server/client
configuration during hydration. Shadcn's first-paint script uses the same selection and storage options as its store.

Changes to released contracts require an appropriate Beachball change file and semantic version decision.
