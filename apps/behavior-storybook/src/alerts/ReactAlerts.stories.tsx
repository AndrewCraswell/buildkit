import { createAlertManager, AlertRegion } from "@buildkitgg/react-alerts"
import type { AlertRendererProps } from "@buildkitgg/react-alerts"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
function Alert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
  return (
    <output className="bk-custom-alert" aria-live="polite">
      <div>
        <strong>{entry.title}</strong>
        <p>{entry.body}</p>
      </div>
      <button onClick={dismiss}>{dismissLabel}</button>
    </output>
  )
}
function Example() {
  const [manager] = useState(() => createAlertManager({ adapter: { Alert } }))
  return (
    <div className="bk-stack">
      <div className="actions">
        <button onClick={() => manager.info({ title: "Custom alert", body: "Rendered with semantic HTML." })}>
          Show alert
        </button>
      </div>
      <AlertRegion manager={manager} />
    </div>
  )
}
const meta = { title: "React/react-alerts", component: Example } satisfies Meta<typeof Example>
export default meta
export const CustomRenderer: StoryObj<typeof meta> = {
  name: "Custom renderer",
  parameters: {
    docs: {
      description: {
        story: "Register an application-owned alert renderer. The manager supplies content and dismissal behavior."
      }
    }
  }
}
