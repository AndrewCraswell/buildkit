import { createAlertManager, AlertRegion, alertComponents } from "@buildkitgg/shadcn-alerts-manager"
import { Alert, AlertTitle, AlertDescription, Button } from "@buildkitgg/shadcn-baseui-kit"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { AlertExamples, alertStory, type AlertScenario } from "./AlertExamples.js"
function Example({ custom = false, scenario }: { custom?: boolean; scenario?: AlertScenario }) {
  const [manager] = useState(() =>
    createAlertManager(
      custom ? { adapter: alertComponents({ Alert, AlertTitle, AlertDescription, Button }) } : undefined
    )
  )
  return <AlertExamples manager={manager} Region={AlertRegion} Button={Button} scenario={scenario} />
}
const meta = { title: "shadcn/shadcn-alerts-manager", component: Example } satisfies Meta<typeof Example>
export default meta
export const Dismissal: StoryObj<typeof meta> = alertStory("dismiss")
export const ReplaceExisting: StoryObj<typeof meta> = { ...alertStory("replace"), name: "Replace existing" }
export const UndoAction: StoryObj<typeof meta> = { ...alertStory("action"), name: "Undo action" }
export const IndependentRegions: StoryObj<typeof meta> = { ...alertStory("regions"), name: "Independent regions" }
export const ClearSilently: StoryObj<typeof meta> = { ...alertStory("silent"), name: "Clear silently" }
export const CustomComponents: StoryObj<typeof meta> = {
  name: "Custom components",
  args: { custom: true },
  parameters: {
    docs: { description: { story: "Register your application’s Alert components while keeping the shared behavior." } }
  }
}
