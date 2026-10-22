# @buildkitgg/react-configuration

React bindings for `@buildkitgg/configuration-core`. No provider component or UI library required.

Configuration owns application/provider decisions; preferences owns the user's choices. For example, use
`config.useSetting("defaultLanguage")` for the configured default, and a preference for the user's selected language.
Resolve `selectedLanguage ?? defaultLanguage` in the app. Developer overrides are separate from user preferences. See
the [core provider contract](../../core/configuration-core/README.md) for adapter responsibilities.

```tsx
import { createConfiguration } from "@buildkitgg/react-configuration"

// Create at the application boundary, outside component rendering.
const config = createConfiguration({
  defaults: { newCheckout: false },
  context: {},
  provider: { load: () => ({ newCheckout: true }) }
})
void config.refresh()

function Checkout() {
  const { value } = config.useSetting("newCheckout")
  return value ? <NewCheckout /> : <StandardCheckout />
}

function FlagStatus() {
  const { status, error } = config.useConfiguration()
  return <p>{error?.message ?? status}</p>
}
```

`config.useSetting(key)` returns the inferred value type, default value, and source. It subscribes to that setting's
snapshot; unrelated setting updates do not rerender it. `config.useConfiguration()` subscribes to the complete values,
context, status, and error snapshot. Both use `useSyncExternalStore` and clean up subscriptions on unmount.

The application owns client creation, loading, and disposal. Hooks do not start network requests or dispose a shared
client. If creating a client in an effect, create a fresh instance in each setup and dispose that instance in cleanup so
Strict Mode can replay setup safely.

For SSR, create separate clients per request. Server snapshots render defaults; the client uses the same defaults during
hydration, then reflects loaded values and persisted overrides. Do not render from `client.get()` on the server when
using these hooks for hydration.

Override controls use the core client's `override`, `reset`, and `resetAll` methods. No preferences API or
vendor-specific types are exposed by these hooks.

The factory returns all core commands alongside bound hooks. You can destructure the hooks once:

```tsx
export const { useSetting, useConfiguration } = config
// Inside a component: useSetting("newCheckout")
// Outside React: config.get("newCheckout"), config.setContext({}), config.reset("newCheckout")
```

Setting names, values, and context are inferred. Explicit `createConfiguration<Settings, Context>(options)` preserves
declared unions. Configure the instance once; hooks take no client argument.
