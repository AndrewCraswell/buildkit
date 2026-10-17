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
import { ModalExamples } from "./ModalExamples.js"
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
export const Playground: StoryObj<typeof meta> = {}
export const TypedForm: StoryObj<typeof meta> = { args: { scenario: "form" } }
export const InferredState: StoryObj<typeof meta> = { args: { scenario: "state" } }

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
  render: () => <ShadcnModalsExample adapter={registryAdapter} />,
  parameters: {
    docs: {
      source: {
        code: 'import { createModalManager, ModalRenderer, baseUiComponents } from "@buildkitgg/shadcn-modals-manager"\nimport * as dialog from "@/components/ui/dialog"\nimport { Button } from "@/components/ui/button"\n\nconst modals = createModalManager({\n  adapter: baseUiComponents({ ...dialog, Button })\n})\n\n<ModalRenderer manager={modals} />'
      }
    }
  }
}
