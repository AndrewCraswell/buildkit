import { createModalManager, ModalRenderer, useModalExit } from "@buildkitgg/react-modals"
import type { ModalSurfaceProps } from "@buildkitgg/react-modals"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect, useRef, useState } from "react"
import { ModalExamples } from "./ModalExamples.js"
import type { ExampleButtonProps, ExampleInputProps } from "./ModalExamples.js"

function NativeSurface({ entry, body, children }: ModalSurfaceProps<object>) {
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
      aria-labelledby={`native-title-${entry.key}`}
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
      <h2 id={`native-title-${entry.key}`}>{entry.content.title}</h2>
      <p>{entry.content.description}</p>
      {body}
      <div className="actions">
        {entry.content.actions.map((action, index) => (
          <button key={index} onClick={action.onClick} disabled={entry.isPending}>
            {action.label}
          </button>
        ))}
      </div>
      {children}
    </dialog>
  )
}
function NativeButton(props: ExampleButtonProps) {
  return <button {...props} />
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
export const NativeDialog: StoryObj<typeof meta> = {}
