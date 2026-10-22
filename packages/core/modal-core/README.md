# @buildkitgg/modal-core

Framework-independent modal stacks, typed results, updates, and cleanup.

```sh
pnpm add @buildkitgg/modal-core
```

```tsx
import { createModalStore } from "@buildkitgg/modal-core"

const modals = createModalStore<string>()
const handle = modals.open({
  defaultResult: false,
  createContent: () => "Delete draft?"
})
handle.update(() => "Delete this draft permanently?")
handle.close(true)
const confirmed = await handle
// A renderer calls entry.finishExit() after its exit animation.
```

Core does not import React, access the DOM, or schedule animation timers. Closing a parent dismisses its descendants.
IDs remain reserved until exit completes. Results are set once. Snapshots are immutable; content is opaque. Server
snapshots are empty.

## API

- `createModalStore<TContent>()`: isolated observable stack.
- open(): awaitable handle with close, dismiss, submit, update and isActive.
- handle.update(current => replacement): replaces opaque content and notifies subscribers when the value changes. Return
  a new object for object content; this is not a partial merge. Closed handles ignore updates.
- beforeDismiss(): optional cancellation guard; explicit close and teardown bypass it.
- submit(action): prevents duplicate work, exposes pending/errors and closes with the successful result.
- closeAll(): dismiss the stack, preserving entries for exit.
- clear / dispose: settle pending results and remove entries.

Keep the returned handle to update that instance; there is no update-by-ID method.

See [update examples](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modal-updates.md),
[lifecycle and architecture](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md) and
[package guide](docs/README.md).

Pass `onClose({ id, result, reason })` to `open()` to observe settlement once after snapshot notification. Reasons
distinguish completion, dismissal, parent closure, close-all, clear and disposal. Observers cannot veto closure.
Observer failures are aggregated after all observers run; results stay settled. See
[close event semantics](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modal-updates.md#close-telemetry).
