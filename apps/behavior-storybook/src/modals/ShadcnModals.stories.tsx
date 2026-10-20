import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@buildkitgg/shadcn-baseui-kit"
import { baseUiComponents, createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"
import type { ModalAdapter } from "@buildkitgg/shadcn-modals-manager"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ModalExamples, modalStory } from "./ModalExamples.js"
import type { ExampleInputProps, ModalExampleScenario } from "./ModalExamples.js"

function NameInput({ onChange, ...props }: ExampleInputProps) {
  return <Input {...props} onChange={(event) => onChange(event.target.value)} />
}
type ShadcnModalsExampleProps = ModalExampleScenario & { adapter?: ModalAdapter }

function ShadcnModalsExample({ scenario, adapter }: ShadcnModalsExampleProps) {
  const [manager] = useState(() => createModalManager({ adapter }))
  return (
    <ModalExamples manager={manager} Button={Button} Input={NameInput} scenario={scenario}>
      <ModalRenderer manager={manager} />
    </ModalExamples>
  )
}
const meta = { title: "shadcn/shadcn-modals-manager", component: ShadcnModalsExample } satisfies Meta<
  typeof ShadcnModalsExample
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

// The kit provides Base UI-backed shadcn components. App-owned registry components use the same binding.
const registryAdapter = baseUiComponents({
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
})
export const RegistryComponents: StoryObj<typeof meta> = {
  name: "Registry components",
  render: () => <ShadcnModalsExample adapter={registryAdapter} />,
  parameters: {
    docs: {
      description: { story: "Use application-owned dialog components with the same modal manager API." },
      source: {
        code: 'import { createModalManager, ModalRenderer, baseUiComponents } from "@buildkitgg/shadcn-modals-manager"\nimport * as dialog from "@/components/ui/dialog"\nimport { Button } from "@/components/ui/button"\n\nconst modals = createModalManager({\n  adapter: baseUiComponents({ ...dialog, Button })\n})\n\n<ModalRenderer manager={modals} />'
      }
    }
  }
}
