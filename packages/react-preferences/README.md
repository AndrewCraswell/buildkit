# @buildkitgg/react-preferences

Provider-free React hooks for `@buildkitgg/preferences-core`. Private during incubation.

```tsx
import { usePreference, usePreferences } from "@buildkitgg/react-preferences"
import { preferences } from "./preferences"

export function PageSize() {
  const [pageSize, setPageSize] = usePreference(preferences, "pageSize")
  return <button onClick={() => setPageSize(50)}>{pageSize ?? "Not set"}</button>
}
```

`usePreference(store, key)` returns a readonly tuple of the typed value (`T[K] | undefined`) and its typed setter.
`usePreferences(store)` returns the whole readonly snapshot. Both use `useSyncExternalStore`; no context or provider is
required. Keys and values are inferred from the store. The per-key hook subscribes to the whole snapshot in this initial
version, so changing another preference can rerender its consumer.

Create stores outside render, use one instance per application or SSR request, and dispose after consumers unmount.
Non-React callers use the same store directly. Server rendering uses the construction-time default snapshot. Consumers
must use matching server/client defaults, and own persistence connection timing in their framework shell.

[Maintenance](docs/README.md)
