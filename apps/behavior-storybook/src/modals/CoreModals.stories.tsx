import { createModalStore } from "@buildkitgg/modal-core"
import { useModals } from "@buildkitgg/react-modals"
import { ExampleResult } from "@repo/storybook-config/examples"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useState } from "react"

function CoreLifecycle() {
  const [store] = useState(() => createModalStore<string>())
  const [result, setResult] = useState("No result")
  const entries = useModals(store)
  useEffect(() => () => store.clear(), [store])
  return (
    <section className="bk-stack">
      <div className="actions">
        <button
          onClick={async () => {
            const handle = store.open({ defaultResult: "dismissed", createContent: () => "Example content" })
            setResult(await handle)
          }}
        >
          Open entry
        </button>
        <button onClick={store.closeAll}>Close all</button>
        <button onClick={store.clear}>Clear immediately</button>
      </div>
      <ExampleResult label="Settled value">{result}</ExampleResult>
      <ul className="bk-core-entries">
        {entries.map((entry) => (
          <li className="bk-core-entry" key={entry.key}>
            <div className="bk-row">
              <strong>{entry.content}</strong>
              <code>{entry.status}</code>
            </div>{" "}
            <button onClick={entry.dismiss}>Dismiss entry</button>{" "}
            <button onClick={entry.finishExit} disabled={entry.status !== "closing"}>
              Finish exit
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
const meta = { title: "Core/modal-core", component: CoreLifecycle } satisfies Meta<typeof CoreLifecycle>
export default meta
export const Lifecycle: StoryObj<typeof meta> = {
  parameters: {
    docs: {
      description: {
        story:
          "Follow an entry from open to closing, then complete its exit. The core owns lifecycle; a renderer controls presentation."
      }
    }
  }
}
