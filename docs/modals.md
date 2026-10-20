# Modal packages

Create a manager and mount one renderer inside the app's UI provider. Services, event handlers and components can import
the manager; opening a modal does not require React context.

| Package                   | Responsibility                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `modal-core`              | Stack, typed results, pending actions, dismissal guards, snapshots and disposal     |
| `react-modals`            | Typed state, React content, confirm/alert helpers, subscriptions and host lifecycle |
| `shadcn-modals-manager`   | Default shadcn dialogs and optional Base UI or Radix registry components            |
| `fluentui-modals-manager` | Fluent dialogs and motion integration                                               |

Both adapters use the same manager and renderer. Core has no framework, DOM or timer dependencies. UI libraries own
portals, focus trapping and accessibility. Form libraries are optional consumer integrations.

## Results and state

- `confirm(options)` resolves to `true` on confirmation and `false` on cancellation.
- `open(options)` and `alert(options)` resolve to `undefined`.
- `createModal({ initialState, render, defaultResult, ...options })` defines a reusable typed modal.
- Its `open(overrides?, { id }?)` merges shallow overrides onto fresh top-level defaults.
- `handle.update(patch)` and `handle.update(current => patch)` merge typed state changes.
- `handle.close(result)` completes immediately with the declared result. `await handle` receives that result.

State is inferred from `initialState`. The result defaults to the state type plus `null`; an annotated React component
or explicit `<State, Result>` can choose a different result. `defaultResult` must fit that result and does not narrow
it. Named components and inline `render` components receive the same `data`, `controls`, `isPending` and `error` props.
They are rendered as React components, so hooks and local state survive data and activity updates.

Defaults and updates are shallow. Treat nested values as immutable and replace them through updates. Use an
`initialState: () => ({ ... })` factory for independent nested objects on every opening. This supports values such as
callbacks and UI objects without imposing JSON serialization or cloning semantics.

See [typed forms and inferred state](modal-forms.md) for examples.

## Submission and dismissal

`controls.submit(action)` invokes the action with current data. Only one submission or dismissal check runs per modal.
While it runs, `isPending` is true and cancellation is blocked. On success, its result closes the modal. On failure, the
modal stays open, `error` contains the thrown value, and another attempt may run. A new attempt clears the error. The
returned promise resolves to `true` if it completed the modal, or `false` if blocked, failed or no longer active. The
component decides how to validate fields and render pending/error UI. Built-in action buttons disable while pending.

`beforeDismiss(data)` can return a boolean or a promise of one. It may open a nested confirmation. Escape, backdrop
clicks and explicit cancellation all reach `dismiss()`, which resolves to whether the modal was dismissed. Failed guards
leave it open and expose the error. Changes made during a guard invalidate its approval; request dismissal again.
`dismissible: false` additionally blocks Escape/backdrop requests, while explicit cancellation remains available.

Explicit `close(result)` bypasses guards. `closeAll()`, `clear()`, disposal, host unmount and closing a parent force
settlement with defaults, including pending descendants. These are teardown operations and cannot be vetoed. Late
submission/guard results are ignored. Application requests themselves are not aborted; the application owns that policy.

## Lifecycle and identity

An entry transitions from `open` to `closing` to removed. Results settle once, before notifying subscribers.
`entry.finishExit()` removes closed entries after exit completion. Adapters use Base UI's `onOpenChangeComplete`,
Radix's `onCloseAutoFocus` after native content unmount, and Fluent's `surfaceMotion.onMotionFinish`. They do not guess
animation durations. React also removes entries closed before an animation mounted.

Closing a parent settles its descendants. Closing a child leaves the parent open. A new root may open while a previous
root exits. Instance keys are independent of user IDs, so stale handles cannot affect reused IDs. Blank or duplicate IDs
throw; IDs remain reserved until exit completes.

`closeAll()` retains entries for exit. `clear()` removes them immediately. `dispose()` also removes subscriptions and
prohibits future opens. The React host clears on actual unmount and tolerates StrictMode reconnects. Mount one renderer
per manager. Managers remain reusable after host unmount; create isolated instances per server request. Server snapshots
are empty; open dialogs in event handlers after hydration.

## Adapters

Both UI adapters export `createModalManager`, `ModalRenderer`, `ModalManager`, `ModalRendererProps` and
`ModalSurfaceOptions`, plus identical `ModalManagerOptions` and `ModalAdapter` contracts. Both support
`createModalManager({ labels?, adapter? })` and `<ModalRenderer manager={modals} />` with matching types. Shared modal
definitions, state updates and result handling need only a package import change. `surfaceProps` supports `className`
and `style` in both packages. Native dialog props stay inside custom renderers, outside the portable API.

A custom React surface receives `entry`, `body` and nested `children`. It renders the body, respects `dismissible`,
routes cancellation to `entry.dismiss()`, and calls `entry.finishExit()` after exit. Keep children inside native dialog
context for nested focus handling. Both supplied adapters mark pending surfaces with `aria-busy`. Pass it as
`adapter: { Surface: YourSurface }` when creating a manager. The shared React manager captures the binding once; the
shared renderer uses it for every entry and descendant. No global adapter registry is used. The headless React manager
can omit an adapter, but its renderer requires one.

The default shadcn renderer uses `shadcn-baseui-kit`, included as a dependency. Its `styles.css` export forwards the kit
stylesheet without a global reset. Fluent's renderer belongs inside an existing `FluentProvider`. React is a peer in
both packages; Fluent UI is a peer in the Fluent adapter. App styling, providers and custom UI controls still follow the
selected design system.

For registry-installed shadcn components, use `createModalManager({ adapter: baseUiComponents(components) })` or
`createModalManager({ adapter: radixComponents(components) })`. Supply `Dialog`, `DialogContent`, `DialogTitle`,
`DialogDescription`, `DialogFooter` and `Button`; a dialog module namespace can be spread alongside `Button`. Continue
importing the standard `ModalRenderer`. An explicit adapter overrides the package default and remains attached to the
manager regardless of which renderer export mounts it. When switching design systems, update or remove an explicit
custom adapter as part of the app's UI setup. Wrappers must forward lifecycle props and allow native unmounting after
close. See the [shadcn integration guide](../packages/shadcn/shadcn-modals-manager/README.md).

Default labels are set with `createModalManager({ labels })` in either adapter. Per-call labels override them. Titles
are required; custom bodies must supply a keyboard-accessible completion or cancellation action.

The original Fluent implementation remains untouched in `D:/msft/fluentui-modal-manager`. Buildkit replaces its
singleton, per-instance subscription pattern and fixed exit delays with isolated stores, one host subscription and
native exit events.
