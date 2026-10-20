# Inline alerts and native toasts

Use inline alerts for information that remains relevant until the user or application resolves it. Use native toasts for
transient action feedback. Their rendering and lifecycle requirements differ; Buildkit does not maintain a second toast
queue alongside a framework queue.

## Package boundaries

| Package                   | Responsibility                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `alert-core`              | Generic content, independent regions, IDs, replacement, immutable snapshots, handles, callbacks and teardown |
| `react-alerts`            | ReactNode payloads, useSyncExternalStore subscription, SSR snapshot and adapter rendering                    |
| `shadcn-alerts-manager`   | Default kit Alert composition and optional registry-component adapter                                        |
| `fluentui-alerts-manager` | Fluent MessageBar composition using the same manager and region contracts                                    |

Both UI packages export `createAlertManager`, `AlertRegion`, and `useAlerts`. Changing the import keeps the behavior API
intact. Applications still supply their UI theme/styles. The optional adapter belongs on the factory, not the region.
The shadcn `alertComponents` helper accepts structural component props; Alert composition does not depend on either Base
UI or Radix primitives. Core has no React, browser globals, DOM events, or UI dependencies.

## Existing implementation review

The source reviewed was `D:/msft/fluentui-message-bar-manager/src/MessageBarManager.ts`, its types, surface, and region.
The original repository is unchanged. This is a new API, not a backward-compatible replacement release.

- Replace the module singleton with `createAlertManager()`; applications may export their own client instance.
- Preserve region-local IDs, insertion order, replacement in place, handles, and separate dismiss versus flush
  semantics.
- Replace mutable descriptors with frozen entry snapshots. Payload objects remain caller-owned.
- Bind handles to an entry generation: replacing an ID invalidates older handles, avoiding stale async work dismissing a
  newer notification. Direct manager commands intentionally address the current ID.
- Remove legacy `timeoutMs`. The old surface started timers on mount and restarted them on remount. Persistent alerts
  now have an explicit lifetime; transient messages belong to the native toast manager. This also avoids duplicate
  timers.
- Use individual surfaces for announcements; do not wrap live alert surfaces inside another live status region.
- `dispose()` clears without callbacks and releases subscriptions. `flush()` clears without callbacks and keeps
  observers.

## Why there is no toast-core or toast adapter package

Fluent UI already exposes dispatch, update, dismiss, pause, and resume through
[`useToastController`](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-toast/library/src/state/useToastController.ts).
[Current shadcn Base UI Toast](https://ui.shadcn.com/docs/components/base/toast) uses Base UI's manager, which also
supports [external calls and promise notifications](https://base-ui.com/react/components/toast).
[The shadcn Sonner integration](https://ui.shadcn.com/docs/components/radix/sonner) provides another complete native
path. The existing Buildkit component kit includes `SonnerToaster`.

These engines already own timing, visibility, dismissal interactions, positioning, and announcements. Sharing an alert
queue with them would create competing sources of truth. A future common toast facade would only be justified by an
actual application requirement for one cross-library command API; it should delegate to native engines rather than
reimplement them. It is not required to display or manage toasts today.

Storybook includes both alert adapters, core typed payloads, a headless React renderer, and custom shadcn components. No
toast package or generic queue package is introduced.
