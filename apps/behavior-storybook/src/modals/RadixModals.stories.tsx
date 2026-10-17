import { Button, Input } from "@buildkitgg/shadcn-baseui-kit"
import { createModalManager, ModalRenderer, radixComponents } from "@buildkitgg/shadcn-modals-manager"
import type { RadixModalComponents } from "@buildkitgg/shadcn-modals-manager"
import * as Dialog from "@radix-ui/react-dialog"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { ModalExamples } from "./ModalExamples.js"
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
      source: {
        code: 'import { createModalManager, ModalRenderer, radixComponents } from "@buildkitgg/shadcn-modals-manager"\nimport * as dialog from "@/components/ui/dialog"\nimport { Button } from "@/components/ui/button"\n\nconst modals = createModalManager({\n  adapter: radixComponents({ ...dialog, Button })\n})\n\n<ModalRenderer manager={modals} />'
      }
    }
  }
} satisfies Meta<typeof RadixModalsExample>
export default meta
export const Playground: StoryObj<typeof meta> = {}
export const TypedForm: StoryObj<typeof meta> = { args: { scenario: "form" } }
export const InferredState: StoryObj<typeof meta> = { args: { scenario: "state" } }
