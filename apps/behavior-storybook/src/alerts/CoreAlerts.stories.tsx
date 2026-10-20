import { createAlertStore } from "@buildkitgg/alert-core"
import { ExampleResult } from "@repo/storybook-config/examples"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, useSyncExternalStore } from "react"
function Example() {
  const [store] = useState(() => createAlertStore<{ message: string }>())
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
  return (
    <section>
      <div className="bk-stack">
        <div className="bk-row">
          <div>
            <p className="bk-item-title">Project sync</p>
            <p className="bk-item-description">A typed payload, independent of rendering</p>
          </div>
          <div className="actions">
            <button onClick={() => store.add({ id: "sync", body: { message: "Sync requires attention" } })}>
              Add payload
            </button>
            <button
              disabled={!entries.length}
              onClick={() => store.update("sync", { body: { message: "Sync completed" }, intent: "success" })}
            >
              Mark complete
            </button>
          </div>
        </div>
        {entries.length ? (
          <div className="bk-core-entry">
            <code>body.message</code>
            <p>{entries[0]?.body?.message}</p>
            <div className="actions">
              <button onClick={() => store.flush()}>Clear payload</button>
            </div>
          </div>
        ) : (
          <div className="bk-empty">No payload stored</div>
        )}
      </div>
      <ExampleResult label="Stored entries">{entries.length}</ExampleResult>
    </section>
  )
}
const meta = {
  title: "Core/alert-core",
  component: Example,
  parameters: {
    docs: {
      description: { story: "Store and update an object payload without coupling it to a UI component." },
      source: {
        code: 'const alerts = createAlertStore<{ message: string }>()\nalerts.add({ id: "sync", body: { message: "Sync requires attention" } })\nalerts.update("sync", { body: { message: "Sync completed" } })'
      }
    }
  }
} satisfies Meta<typeof Example>
export default meta
export const TypedPayload: StoryObj<typeof meta> = {
  name: "Typed payload"
}
