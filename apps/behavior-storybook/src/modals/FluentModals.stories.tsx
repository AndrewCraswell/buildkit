import { createModalManager, ModalRenderer } from "@buildkitgg/fluentui-modals-manager"
import { Button, FluentProvider, Input, webLightTheme } from "@fluentui/react-components"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ModalExamples, modalStory } from "./ModalExamples.js"
import type { ExampleButtonProps, ExampleInputProps, ModalExampleScenario } from "./ModalExamples.js"

function NameInput({ onChange, ...props }: ExampleInputProps) {
  return <Input {...props} onChange={(_, data) => onChange(data.value)} />
}
function ExampleButton({ variant, ...props }: ExampleButtonProps) {
  return <Button {...props} appearance={variant === "outline" ? "secondary" : "primary"} />
}
function FluentModalsExample({ scenario }: ModalExampleScenario) {
  const [manager] = useState(() => createModalManager())
  return (
    <FluentProvider theme={webLightTheme}>
      <ModalExamples manager={manager} Button={ExampleButton} Input={NameInput} scenario={scenario}>
        <ModalRenderer manager={manager} />
      </ModalExamples>
    </FluentProvider>
  )
}
const meta = { title: "Fluent UI/fluentui-modals-manager", component: FluentModalsExample } satisfies Meta<
  typeof FluentModalsExample
>
export default meta
export const Confirmation: StoryObj<typeof meta> = modalStory("confirmation")
export const Acknowledgment: StoryObj<typeof meta> = modalStory("alert")
export const TypedForm: StoryObj<typeof meta> = { ...modalStory("form"), name: "Typed form" }
export const InitialState: StoryObj<typeof meta> = { ...modalStory("state"), name: "Initial state" }
export const NestedDialogs: StoryObj<typeof meta> = { ...modalStory("nested"), name: "Nested dialogs" }
export const ExplicitDismissal: StoryObj<typeof meta> = { ...modalStory("required"), name: "Explicit dismissal" }
export const SaveAndRetry: StoryObj<typeof meta> = { ...modalStory("async"), name: "Save and retry" }
export const UnsavedChanges: StoryObj<typeof meta> = { ...modalStory("guard"), name: "Unsaved changes" }
export const ExternalUpdate: StoryObj<typeof meta> = { ...modalStory("external"), name: "External update" }
