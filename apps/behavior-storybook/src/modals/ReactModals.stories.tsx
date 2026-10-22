import { createModalManager, ModalRenderer, useModalExit } from "@buildkitgg/react-modals"
import type { ModalSurfaceProps } from "@buildkitgg/react-modals"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useRef, useState } from "react"
import { ModalExamples } from "./ModalExamples.js"
import type { ExampleButtonProps, ExampleInputProps } from "./ModalExamples.js"

function NativeSurface({ entry, title, body, footer, children }: ModalSurfaceProps<object>) {
  const ref = useRef<HTMLDialogElement>(null)
  useModalExit(entry)
  useEffect(() => {
    if (entry.status === "open") {
      ref.current?.showModal()
    } else {
      ref.current?.close()
      entry.finishExit()
    }
  }, [entry])
  return (
    <dialog
      ref={ref}
      aria-label={entry.content.ariaLabel}
      aria-labelledby={entry.content.ariaLabel ? undefined : `native-title-${entry.key}`}
      aria-busy={entry.isPending || undefined}
      className="native-modal-example"
      onCancel={(event) => {
        event.stopPropagation()
        event.preventDefault()
        if (entry.content.dismissible !== false) {
          entry.dismiss()
        }
      }}
    >
      <h2 id={`native-title-${entry.key}`}>{title}</h2>
      <p>{entry.content.description}</p>
      {body}
      <div className="actions">{footer}</div>
      {children}
    </dialog>
  )
}
function NativeButton({ variant, ...props }: ExampleButtonProps) {
  return <button {...props} data-variant={variant} />
}
function NativeInput({ onChange, ...props }: ExampleInputProps) {
  return <input {...props} onChange={(event) => onChange(event.target.value)} />
}
function ReactModalsExample() {
  const [manager] = useState(() => createModalManager({ adapter: { Surface: NativeSurface } }))
  return (
    <ModalExamples manager={manager} Button={NativeButton} Input={NativeInput}>
      <ModalRenderer manager={manager} />
    </ModalExamples>
  )
}
const meta = { title: "React/react-modals", component: ReactModalsExample } satisfies Meta<typeof ReactModalsExample>
export default meta
export const NativeDialog: StoryObj<typeof meta> = {
  name: "Native dialog",
  parameters: {
    docs: { description: { story: "Render a confirmation with a native dialog element and your own adapter." } }
  }
}
