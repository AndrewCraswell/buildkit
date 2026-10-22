# @buildkitgg/configuration-core

Typed configuration with defaults, provider evaluation, and optional developer overrides. No React or vendor SDK
dependency.

## Configuration and preferences

Configuration represents application or provider decisions: a rollout switch, an experiment variant, a page-size limit,
or a default language. Preferences represents a user's choice, such as language or theme.

```ts
const language = preferences.get("language") ?? config.get("defaultLanguage")
```

The app chooses that precedence explicitly. Resetting the language preference restores the configured default without
changing configuration. A configuration developer override is a diagnostic control, not the user's language preference.
Preferences provides override persistence internally, under a separate application-owned storage key.

## Usage

```ts
import { createConfiguration } from "@buildkitgg/configuration-core"

const config = createConfiguration({
  defaults: { newCheckout: false, pageSize: 20 },
  context: { userId: "customer-42", cohort: "standard" },
  provider: {
    async load(context, { signal }) {
      // Call your SDK or validated application endpoint here.
      return { newCheckout: context.cohort === "early-access" }
    }
  },
  overrides: { storage: "localStorage", key: "my-app:configuration-overrides" }
})

await config.refresh()
config.get("newCheckout") // boolean; unknown names are compile errors
config.override("newCheckout", true)
config.reset("newCheckout") // restores the latest provider value, or the default
await config.setContext({ userId: "customer-43", cohort: "early-access" })
config.dispose()
```

## Types and validation

Keys, scalar values, and targeting context are inferred from the supplied objects. For narrower unions, supply
`createConfiguration<Settings, Context>(options)` and optionally
`validate: { variant: value => value === "control" || value === "experiment" }`.

Settings support booleans, strings, and finite numbers. Runtime checks reject provider values of the wrong scalar type;
optional validators constrain unions and ranges without a schema dependency. Unknown provider keys are ignored. An
invalid known value rejects the whole evaluation. TypeScript declarations alone do not validate external JSON.

## Provider contract and lifecycle

The contract is an adapter boundary for services such as LaunchDarkly, ECS, or Azure App Configuration; these adapters
are not bundled. Context is an application-defined generic object, not a fixed user-ID schema. Providers can wrap a
local map, an async endpoint, or an SDK. Core imposes no endpoint, authentication, polling, or transport format.

```ts
import type { ConfigurationProvider } from "@buildkitgg/configuration-core"

type Settings = { newCheckout: boolean; defaultLanguage: string }
type Context = { userId: string; region: string }

// Application-owned service integration, implemented with your chosen SDK.
declare const service: {
  evaluate(context: Readonly<Context>, signal: AbortSignal): Promise<Partial<Settings>>
  onChange(listener: () => void): () => void
}

const provider: ConfigurationProvider<Settings, Context> = {
  load: (context, { signal }) => service.evaluate(context, signal),
  subscribe: (listener) => service.onChange(listener)
}
```

`subscribe` is an invalidation notification, not a patch stream. If a service sends patches, its adapter must maintain
the current values and return a complete evaluation from `load`. Context-dependent SDK operations must be isolated or
serialized by the adapter: ignoring a stale response in core cannot undo changes to a shared SDK's global targeting
context. Cancellation is cooperative. The adapter must retain SDK-specific metadata and handle explicit exposure
tracking when required; the core contract currently represents resolved scalar settings, not an experimentation SDK.

`load(context, { signal })` returns a complete `Partial<Settings>` snapshot, synchronously or asynchronously. Missing
settings use defaults. Optional `subscribe(onChange)` signals that values need reloading and returns an unsubscribe
function. The adapter owns SDK setup, authentication, targeting rules, polling, and exposure tracking. Merely reading a
setting does not record an experiment exposure.

Construction does not load or subscribe to a provider. Call `refresh()` to begin. `getSnapshot()` exposes `values`,
`context`, `status` (`idle`, `loading`, `ready`, or `error`), and `error`. Provider errors settle the refresh promise
and appear in the snapshot. Refresh failures retain the previous successful evaluation for the same context.
`setContext()` replaces the entire context and immediately clears previous provider values. Superseded requests receive
an abort signal and their responses are ignored even if they ignore cancellation.

Snapshots and context are shallowly frozen. Treat nested context data as immutable. Create a client per application or
server request, never share a targeted client across server users. `dispose()` aborts pending work and removes
subscriptions; it does not destroy a shared vendor SDK. Do not reuse a disposed client.

## Overrides

Precedence is **override → provider → default**. Overrides are disabled unless enabled with `true` (memory), or
`{ storage: "localStorage" | "sessionStorage", key }`. Storage always requires a namespace key. Preferences handles
persistence internally: callers only use `override`, `reset`, and `resetAll`. Remote evaluations are never persisted as
overrides.

Local storage follows changes from other same-origin tabs. Session storage stays within the browser session's storage
scope. Malformed or incompatible saved values are ignored. Unavailable storage falls back to memory. Overrides survive
targeting-context changes until reset. Enable them deliberately in development; client-side configuration is not an
authorization boundary.

`getSetting(key)` returns a stable `{ value, defaultValue, source }` snapshot. `subscribe()` supports framework
adapters. Server snapshots always use the initial defaults and context for deterministic hydration; load provider values
on the client after hydration.
