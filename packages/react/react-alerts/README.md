# @buildkitgg/react-alerts

Persistent inline alerts with external commands and shared lifecycle behavior.

## Usage

```tsx
import { createAlertManager, AlertRegion } from "@buildkitgg/react-alerts"

export const alerts = createAlertManager({ adapter: { Alert: YourAlert } })
<AlertRegion manager={alerts} />

alerts.warning({ id: "billing", title: "Update your payment method" })
```

## Behavior

- add / info / success / warning / error: return a region-bound handle.
- handle.update / handle.dismiss / handle.isActive: control that exact alert instance.
- getSnapshot / subscribe: stable snapshots and region-scoped notifications.
- dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.
- dispose(): clear silently, notify subscribers, and reject future additions.

Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking
dismissal; old handles become inactive. Mount once per region. ReactNode content and optional adapters are
React-specific; the store has no browser effects.

IDs are scoped to a region (default: `default`). All alerts are rendered; there is no hidden backlog or automatic
timeout. `dismissible: false` hides the dismiss control but does not prevent programmatic dismissal. Actions do not
automatically dismiss an alert. `onDismiss` runs once after removal, including `dismissAll`; it does not run for
replacement, `flush`, or `dispose`. Callback errors are collected and re-thrown as an AggregateError after all
notifications and dismissal callbacks have run.

Snapshots and entry containers are frozen. Generic payloads and React elements are not deep-frozen. Updates produce new
entries, preserving previous snapshots. Treat payloads as immutable. Server snapshots are empty to avoid leaking request
data; create stores per request, not as server singletons.

See [alert architecture and native toast guidance](https://github.com/AndrewCraswell/buildkit/blob/main/docs/alerts.md).
