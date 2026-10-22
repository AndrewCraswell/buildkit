# Modal slots and updates

React, shadcn and Fluent managers expose the same `title`, `body` and `footer` slots. Each accepts a `ReactNode` or
`{ component: Component }`. Use nodes for supplied content and component slots for live data, controls, pending state
and errors. The manager owns lifecycle; applications own buttons, forms, validation and workflow transitions.

```tsx
const modal = modals.confirm({
  title: <strong>Preview</strong>,
  body: <Preview />,
  footer: <YourButtons />
})
modal.update({ title: "Ready", body: <UpdatedPreview />, footer: null })
modal.update({ footer: undefined, confirmLabel: "Publish" })
const published = await modal
```

An explicit footer replaces all helper buttons. Consumers control their components, variants, styles, icons and event
handlers. Omit `footer` on `open`, `alert` or `confirm` to use the adapter's default buttons. Custom definitions have no
default footer. `null` clears a slot; `footer: undefined` restores the helper footer on standard modals.

## Live component slots

```tsx
const counter = modals.createModal({
  title: "Quantity",
  initialState: { count: 0 },
  defaultResult: null,
  body: {
    component: function Counter({ data, controls }) {
      return (
        <button onClick={() => controls.update({ data: { count: data.count + 1 } })}>Quantity: {data.count}</button>
      )
    }
  },
  footer: {
    component: function Footer({ data, controls, isPending }) {
      return (
        <button disabled={isPending} onClick={() => controls.close(data)}>
          Save {data.count}
        </button>
      )
    }
  }
})
const modal = counter.open({ count: 3 })
modal.update(({ data }) => ({ title: "Review quantity", data: { count: data.count + 1 } }))
const result = await modal
```

All component slots receive `{ data, controls, isPending, error }`. For custom definitions, `data` is the custom state;
for standard modals it is the current opening options. Extracted components use `ModalSlotProps<Data, Result, Surface>`
or `StandardModalSlotProps<Surface, Result>`. Components may use hooks normally. Keeping the same component type and
React key preserves its local state; replacing its type or key resets that slot. Define reusable components outside
render, and pass them as `{ component: MyBody }`. A supplied node is rendered directly without injected props.

## One update method

Handles and slot controls expose `update(patch)` and `update(current => patch)`. Updates can change slots, labels,
description, `ariaLabel`, `surfaceProps`, dismissibility and `onClose`, with custom state under `data`. Changes commit
together in one notification. Each opening has independent values. IDs, default results and dismissal guards stay fixed.

Omitted fields remain unchanged. Presentation and `data` each merge shallowly; nested objects, including `surfaceProps`,
are replaced. Spread current nested values when merging them. Omitted or undefined `data` preserves custom data. Use
`null` to clear content and callbacks, or `undefined` to reset optional properties. Unchanged patches do not notify.
Closed handles ignore updates and do not invoke updater functions. Updates during a pending dismissal guard invalidate
its approval, unless the patch leaves the state unchanged. There is no manager-level update-by-ID method.

`title` supports formatted text and components. Supply a non-empty `ariaLabel` when the title is absent or has no
accessible text; it overrides title-based naming. Empty primitive titles without a label are rejected before committing
an opening or update. Component and icon titles cannot be inspected for accessible text: callers must supply their name.
The adapter owns focus, Escape, backdrop dismissal and native dialog semantics.

## Close telemetry

```tsx
const modal = modals.confirm({ title: "Publish?", onClose: trackClosed })
modal.update({ onClose: ({ id, result, reason }) => trackWithContext({ id, result, reason }) })
```

The latest `onClose` runs once at settlement, after subscribers receive the committed snapshot, before exit animation
necessarily finishes. It observes closure and cannot veto it. Use `beforeDismiss` on a custom definition for a guard.
`onClose: null` removes the observer. The awaitable handle returns only the typed result.

| Reason          | Trigger                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| `completed`     | Explicit `close(result)` or successful `submit()`                              |
| `dismissed`     | Accepted dismissal, including Escape, backdrop or a helper Cancel/Close button |
| `parent-closed` | An ancestor closed                                                             |
| `close-all`     | Manager `closeAll()`                                                           |
| `cleared`       | Manager `clear()`, including renderer unmount                                  |
| `disposed`      | Manager `dispose()`                                                            |

Completion provides the supplied result; other paths provide the default result. Blocked dismissals emit no event.
Observers run synchronously after state and promises have settled. Observer failures are aggregated and thrown after all
subscribers and close observers have run; they do not undo closure or block other settlements. Async telemetry must
handle its own errors. `onClose` is not an exit-animation callback.

## Custom adapters

Custom adapters receive resolved `title`, `body` and `footer` props. Keep `children` for nested modal surfaces. An
optional adapter `DefaultFooter` styles the standard helper buttons. `ModalView.renderSlots(activity)` resolves the
slots with current activity. See [typed forms](modal-forms.md) for a complete definition.

## Framework-independent core

Core content stays opaque; its `update(updater)` returns replacement content. Returning the same reference avoids a
notification. Core `open({ onClose, ... })` supports the same close event and reasons, without a React dependency.
