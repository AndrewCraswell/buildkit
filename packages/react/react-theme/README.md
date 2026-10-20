# @buildkitgg/react-theme

Provider-free React bindings for a Buildkit theme store.

```tsx
import { useTheme } from "@buildkitgg/react-theme"
import { theme } from "./theme"

export function ThemeButton() {
  const { theme: preference, resolvedTheme, setTheme } = useTheme(theme)
  return (
    <button onClick={() => setTheme("dark")}>
      {preference}: {resolvedTheme}
    </button>
  )
}
```

Create the store once outside render and pass that same instance to consumers. Non-React code calls
`theme.setTheme("dark")`; subscribers update through `useSyncExternalStore`. No context or provider is required. The
hook has fully inferred types and ships declarations. React 19.2+ is a peer dependency.

This package does not start browser listeners, access local storage, or apply CSS. Connect the store at your application
boundary. Its stable server snapshot supports hydration: use identical initial options on server and client, with a
store per request for user-specific SSR. Browser-resolved state is reflected after hydration.

[Maintenance](docs/README.md)

`useTheme(store)` also returns `reset()`, which clears the user selection and restores the configured default.
