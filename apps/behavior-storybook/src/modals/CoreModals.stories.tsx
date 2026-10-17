import { createModalStore } from "@buildkitgg/modal-core"
import { useModals } from "@buildkitgg/react-modals"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useState } from "react"
import { Documentation } from "../documentation/Documentation.js"

function CoreLifecycle() {
  const [store] = useState(() => createModalStore<string>())
  const [result, setResult] = useState("No result")
  const entries = useModals(store)
  useEffect(() => () => store.clear(), [store])
  return (
    <Documentation
      title="Modal lifecycle"
      summary="Core stores content and lifecycle state. A renderer decides how to display it and when exit is complete."
    >
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
      <output aria-live="polite">Result: {result}</output>
      <ul>
        {entries.map((entry) => (
          <li key={entry.key}>
            {entry.id}: {entry.content}, {entry.status} <button onClick={entry.dismiss}>Dismiss {entry.id}</button>{" "}
            <button onClick={entry.finishExit} disabled={entry.status !== "closing"}>
              Finish exit {entry.id}
            </button>
          </li>
        ))}
      </ul>
    </Documentation>
  )
}
const meta = { title: "Core/modal-core", component: CoreLifecycle } satisfies Meta<typeof CoreLifecycle>
export default meta
export const Lifecycle: StoryObj<typeof meta> = {}
