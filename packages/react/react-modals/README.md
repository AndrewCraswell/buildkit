# @buildkitgg/react-modals

React subscriptions, typed modal definitions, and shared confirm/alert helpers.

```sh
pnpm add @buildkitgg/react-modals react
```

```tsx
import { createModalManager, ModalRenderer } from "@buildkitgg/react-modals"

export const modals = createModalManager({ adapter: { Surface: YourSurface } })
// Mount once: <ModalRenderer manager={modals} />
const confirmed = await modals.confirm({ title: "Delete draft?" })
// Use a UI adapter unless you need a custom renderer.
```

Mount one renderer per manager. Calls can originate outside React. Components receive data, controls, isPending and
error. Custom result types require a defaultResult for cancellation. The host clears pending modals on actual unmount
and tolerates StrictMode reconnects. A custom surface owns accessibility and calls finishExit. The adapter is selected
once per manager. A headless manager may omit it, but rendering requires one. The shadcn and Fluent packages provide
defaults; they share this manager and renderer implementation.

## API

- createModalManager({ labels?, adapter? }): open, alert, confirm and createModal.
- createModal({ initialState, body, defaultResult, ...options }): inferred state, partial opening overrides and typed
  results.
- controls.update(patch | updater): update presentation and custom state together, with state patches under `data`.
  Functional updaters receive the current presentation and `current.data`.
- controls.submit(action): one pending action, typed success result and retryable errors.
- beforeDismiss(data): optional asynchronous cancellation guard.
- useModals(manager): reactive snapshot without a context provider.
- ModalRenderer: one host, nested rendering and unmount cleanup.
- `ModalAdapter<TSurface>`: a surface component receiving entry, title, body, footer and nested children.
- `ModalManagerOptions<TSurface>` and `ModalSurfaceOptions`: shared defaults for UI adapters. Surface options contain
  className and style; custom React surfaces may supply their own generic type.

## Update an open modal

Keep the handle before awaiting its result. Standard modals patch their opening options:

```tsx
const modal = modals.open({ title: "Loading" })
modal.update({ title: "Ready", body: "Your results are available." })
await modal
```

Custom definitions use the same method, with custom state under `data`:

```tsx
const modal = editProfile.open()
modal.update({ title: "Edit Grace's profile", data: { name: "Grace" } })
modal.update(({ data }) => ({ data: { step: data.step + 1 } }))
```

Here `editProfile` is a definition with `name` and `step` in its initial state. The component's `controls.update()`
works identically. Presentation and data each merge shallowly, together in one notification. Each opening has
independent values. Closed handles ignore updates; IDs are fixed. All slots accept nodes or `{ component: Component }`.
Custom footers own their buttons. `onClose({ id, result, reason })` observes settlement and can be replaced with
`update()`.

See [update examples](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modal-updates.md),
[lifecycle and architecture](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md) and
[package guide](docs/README.md).
