# @buildkitgg/preferences-core

Typed preferences with defaults, user overrides, subscriptions, persistence and JSON backup. No React or validation
library dependency. Private during incubation.

```ts
import { createPreferences } from "@buildkitgg/preferences-core"

type AppPreferences = {
  theme: "system" | "light" | "dark"
  pageSize: number
}

export const preferences = createPreferences<AppPreferences>({
  defaults: { theme: "system" },
  storage: "localStorage",
  key: "my-app-preferences"
})

preferences.get("pageSize") // number | undefined; initially undefined
preferences.set("pageSize", 50)
preferences.reset("pageSize") // undefined again
```

Omit the generic to infer keys and value types from defaults. Primitives widen naturally: `25` becomes `number`, not the
literal `25`. Declare a generic for string unions and preferences without defaults. `get` returns `T[K] | undefined`
even when a default exists. `set`, `get`, and `reset` accept only declared string keys; `set` requires the matching
type. Symbol and numeric preference keys are not supported. All exports include TypeScript declarations.

## API

| Method                         | Behavior                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `get(key)` / `set(key, value)` | Read the effective value or set a user override.                                                                      |
| `reset(key)` / `resetAll()`    | Remove overrides, restoring defaults or undefined.                                                                    |
| `getSnapshot()`                | Stable, frozen effective values until overrides change.                                                               |
| `getServerSnapshot()`          | Stable initial defaults for SSR and hydration.                                                                        |
| `subscribe(listener)`          | Notify after a committed change; returns unsubscribe.                                                                 |
| `exportJson()`                 | JSON object containing only user overrides.                                                                           |
| `importJson(json, { mode })`   | Atomically merge (default) or replace overrides; notify once when changed.                                            |
| `dispose()`                    | Remove factory-owned storage listeners and subscriptions. Reads remain available; writes and new subscriptions throw. |

Defaults and values are copied and deeply frozen so mutating caller-owned objects cannot alter the store. Setting a
value equal to its default still records an explicit override. Objects are replaced as whole values; there is no deep
merge. Use `reset` rather than assigning `undefined`.

## Persistence

Omit `storage` for memory-only state; then `key` is forbidden. Choosing `"localStorage"` or `"sessionStorage"` requires
a nonempty key. The factory connects immediately when a browser is available. Valid stored overrides win over defaults.
Resetting all overrides removes the storage item. Storage denial, quota failures, malformed JSON, and detectable type
mismatches never prevent in-memory use. Invalid saved payloads are ignored as a whole; they do not partially apply.

Local storage synchronizes across same-origin tabs. Session storage persists across reloads within a tab and remains
isolated from other top-level tabs (a browser may initially copy session storage into a newly opened tab). Native
storage events can synchronize same-tab frames. Remote removal or clear restores defaults; remote changes are not echoed
back.

The root is safe to import without `window`. Create per-request stores for user-specific SSR. Initial server and client
defaults must agree. If an SSR framework requires deferred browser initialization, construct without storage and use
`connectPreferencesStorage(store, { storage, key })` from `@buildkitgg/preferences-core/browser` in its client shell.
Call the returned cleanup yourself; do not combine this explicit connection with factory persistence on the same store.

## JSON and runtime limits

Export/import and persistence use the same plain JSON object format. Merge retains other overrides; replace drops them.
A failed explicit import throws without changing state, storage, or subscriptions. A successful import persists once and
notifies once. Defaults are excluded, so an exported explicit choice remains a choice in another app instance.

Only finite numbers, strings, booleans, null, arrays and plain objects are supported. Dates, maps, functions, symbols,
undefined, cycles and unsafe prototype keys are rejected before serialization. Imported values with defaults receive a
shallow category check (number/string/boolean/array/object). Null defaults do not reveal a type. No nested schema or
enum validation is inferred.

**TypeScript types are not runtime schemas.** Imported keys without defaults, unknown keys, array element types and enum
members cannot be validated from a generic. JSON keys are preserved because generic-only keys must work; an unknown
imported key may therefore reappear in export. Treat JSON as trusted configuration, not a security boundary. Domain
packages such as theme must validate their own semantic values. This API intentionally does not require Zod or schemas.

[Maintenance](docs/README.md)
