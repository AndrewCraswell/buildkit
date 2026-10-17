import { createModalManager, ModalRenderer } from "@buildkitgg/fluentui-modals-manager"
import { Button, FluentProvider, Input, webLightTheme } from "@fluentui/react-components"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ModalExamples } from "./ModalExamples.js"
import type { ExampleInputProps, ModalExampleScenario } from "./ModalExamples.js"

function NameInput({ onChange, ...props }: ExampleInputProps) {
  return <Input {...props} onChange={(_, data) => onChange(data.value)} />
}
function FluentModalsExample({ scenario }: ModalExampleScenario) {
  const [manager] = useState(() => createModalManager())
  return (
    <FluentProvider theme={webLightTheme}>
      <ModalExamples manager={manager} Button={Button} Input={NameInput} scenario={scenario}>
        <ModalRenderer manager={manager} />
      </ModalExamples>
    </FluentProvider>
  )
}
const meta = { title: "Fluent UI/fluentui-modals-manager", component: FluentModalsExample } satisfies Meta<
  typeof FluentModalsExample
>
export default meta
export const Playground: StoryObj<typeof meta> = {}
export const TypedForm: StoryObj<typeof meta> = { args: { scenario: "form" } }
export const InferredState: StoryObj<typeof meta> = { args: { scenario: "state" } }
