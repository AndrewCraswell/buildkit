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
- createModal({ initialState, render, defaultResult, ...options }): inferred state, partial opening overrides and typed
  results.
- controls.update(patch | updater): shallow state updates, including updates based on current values.
- controls.submit(action): one pending action, typed success result and retryable errors.
- beforeDismiss(data): optional asynchronous cancellation guard.
- useModals(manager): reactive snapshot without a context provider.
- ModalRenderer: one host, nested rendering and unmount cleanup.
- `ModalAdapter<TSurface>`: a surface component receiving entry, body and nested children.
- `ModalManagerOptions<TSurface>` and `ModalSurfaceOptions`: shared defaults for UI adapters. Surface options contain
  className and style; custom React surfaces may supply their own generic type.

See [lifecycle and architecture](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md) and
[package guide](docs/README.md).
