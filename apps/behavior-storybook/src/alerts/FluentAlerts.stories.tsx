import { createAlertManager, AlertRegion } from "@buildkitgg/fluentui-alerts-manager"
import { Button, FluentProvider, webLightTheme } from "@fluentui/react-components"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { AlertExamples, alertStory, type AlertScenario } from "./AlertExamples.js"
function Example({ scenario }: { scenario?: AlertScenario }) {
  const [manager] = useState(() => createAlertManager())
  return (
    <FluentProvider theme={webLightTheme}>
      <AlertExamples manager={manager} Region={AlertRegion} Button={Button} scenario={scenario} />
    </FluentProvider>
  )
}
const meta = { title: "Fluent UI/fluentui-alerts-manager", component: Example } satisfies Meta<typeof Example>
export default meta
export const Dismissal: StoryObj<typeof meta> = alertStory("dismiss")
export const ReplaceExisting: StoryObj<typeof meta> = { ...alertStory("replace"), name: "Replace existing" }
export const UndoAction: StoryObj<typeof meta> = { ...alertStory("action"), name: "Undo action" }
export const IndependentRegions: StoryObj<typeof meta> = { ...alertStory("regions"), name: "Independent regions" }
export const ClearSilently: StoryObj<typeof meta> = { ...alertStory("silent"), name: "Clear silently" }
