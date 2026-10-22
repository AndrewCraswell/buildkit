import { Button, Input } from "@buildkitgg/shadcn-baseui-kit"
import { createModalManager, ModalRenderer, radixComponents } from "@buildkitgg/shadcn-modals-manager"
import type { RadixModalComponents } from "@buildkitgg/shadcn-modals-manager"
import * as Dialog from "@radix-ui/react-dialog"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ModalExamples, modalStory } from "./ModalExamples.js"
import type { ExampleInputProps, ModalExampleScenario } from "./ModalExamples.js"

// Registry-style wrappers supplied by the application; the manager never imports Radix.
const components: RadixModalComponents = {
  Dialog: Dialog.Root,
  DialogContent: function DialogContent({ showCloseButton: _showCloseButton, ...props }) {
    return (
      <Dialog.Portal>
        <Dialog.Overlay className="radix-example-overlay" />
        <Dialog.Content {...props} className={`radix-example-dialog ${props.className ?? ""}`} />
      </Dialog.Portal>
    )
  },
  DialogTitle: function DialogTitle(props) {
    return <Dialog.Title {...props} className="radix-example-title" />
  },
  DialogDescription: function DialogDescription(props) {
    return <Dialog.Description {...props} className="radix-example-description" />
  },
  DialogFooter: function DialogFooter(props) {
    return <footer {...props} className="radix-example-footer" />
  },
  Button
}
const adapter = radixComponents(components)

function NameInput({ onChange, ...props }: ExampleInputProps) {
  return <Input {...props} onChange={(event) => onChange(event.target.value)} />
}

function RadixModalsExample({ scenario }: ModalExampleScenario) {
  const [manager] = useState(() => createModalManager({ adapter }))
  return (
    <ModalExamples manager={manager} Button={Button} Input={NameInput} scenario={scenario}>
      <ModalRenderer manager={manager} />
    </ModalExamples>
  )
}

const meta = {
  title: "shadcn/shadcn-modals-manager/Radix",
  component: RadixModalsExample,
  parameters: {
    docs: {
      description: { story: "Use application-owned dialog components with the same modal manager API." },
      source: {
        code: 'import { createModalManager, ModalRenderer, radixComponents } from "@buildkitgg/shadcn-modals-manager"\nimport * as dialog from "@/components/ui/dialog"\nimport { Button } from "@/components/ui/button"\n\nconst modals = createModalManager({\n  adapter: radixComponents({ ...dialog, Button })\n})\n\n<ModalRenderer manager={modals} />'
      }
    }
  }
} satisfies Meta<typeof RadixModalsExample>
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

export const ReplaceableSlots: StoryObj<typeof meta> = { ...modalStory("slots"), name: "Replaceable slots" }
