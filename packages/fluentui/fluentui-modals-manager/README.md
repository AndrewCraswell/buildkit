# @buildkitgg/fluentui-modals-manager

Managed Fluent UI dialogs with typed inputs and results.

```sh
pnpm add @buildkitgg/fluentui-modals-manager @fluentui/react-components react react-dom
```

```tsx
import { createModalManager, ModalRenderer } from "@buildkitgg/fluentui-modals-manager"

export const modals = createModalManager()
// Mount inside your existing FluentProvider:
<ModalRenderer manager={modals} />

const confirmed = await modals.confirm({
  title: "Delete draft?",
  confirmLabel: "Delete",
  cancelLabel: "Keep draft"
})
```

React, React DOM and Fluent UI v9 are peer dependencies. Mount the renderer inside your FluentProvider for theme and
portal support. Modal state, results, updates and confirmation semantics are shared with the shadcn adapter.

## API

- createModalManager({ labels?, adapter? }): shared React manager; defaults to Fluent dialogs.
- ModalRenderer: renders the manager's adapter, including Fluent motion completion by default.
- labels: application defaults for confirm, cancel and close buttons.
- ModalManager, ModalManagerOptions, ModalAdapter, ModalRendererProps and ModalSurfaceOptions: shared setup and surface
  contracts.

Pass `adapter: { Surface: YourSurface }` when creating a manager to use a custom React surface. The binding is fixed for
that manager's lifetime and overrides the package default. `ModalRenderer` still takes only `manager`; no separate
renderer factory is needed. See the
[adapter contract](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md#adapters) for lifecycle
responsibilities.

The shadcn adapter exports the same factory, renderer props and shared types. Standard modal code needs only a package
import change. Its default renderer also takes only manager, with no primitive or components prop. Update application
styles, providers and UI-specific custom form controls when changing design systems. If you configured a custom adapter,
update or remove it to use the new design system's components.

Keep the returned modal handle to update an open instance. Standard modals use `handle.update()` for opening options;
custom definitions use the same method with `{ data: partialState, title?, description?, dismissible?, surfaceProps? }`.
Functional updaters receive the current presentation and `current.data`. Every component slot's `controls.update()`
works identically. `title`, `body` and `footer` accept React nodes or `{ component: Component }`. A custom footer
replaces the helper buttons, leaving variants and styling to your components. Use `ariaLabel` when the title has no
accessible text. The updateable `onClose({ id, result, reason })` callback observes settlement once.

See [update examples](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modal-updates.md),
[lifecycle and architecture](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md) and
[package guide](docs/README.md).
