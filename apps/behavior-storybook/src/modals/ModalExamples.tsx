import { useModals } from "@buildkitgg/react-modals"
import type { ModalManager } from "@buildkitgg/react-modals"
import { useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createProfileModal } from "./createProfileModal.js"

export type ExampleButtonProps = {
  children?: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
}
export type ExampleInputProps = {
  id: string
  value: string
  onChange(value: string): void
  type?: "email" | "text"
  disabled?: boolean
  required?: boolean
}
export type ModalExampleScenario = { scenario?: "all" | "form" | "state" }
const scenarioTitles = { all: "Modal management", form: "Typed form", state: "Inferred state" }

export type ModalExamplesProps<TSurface> = ModalExampleScenario & {
  manager: ModalManager<TSurface>
  Button: ComponentType<ExampleButtonProps>
  Input: ComponentType<ExampleInputProps>
  children: ReactNode
}

export function ModalExamples<TSurface>({
  manager,
  Button,
  Input,
  children,
  scenario = "all"
}: ModalExamplesProps<TSurface>) {
  const [result, setResult] = useState("No modal has completed.")
  const entries = useModals(manager)
  async function onConfirm() {
    const confirmed = await manager.confirm({
      title: "Delete draft?",
      description: "The draft will be removed.",
      confirmLabel: "Delete",
      cancelLabel: "Keep draft"
    })
    setResult(confirmed ? "Confirmed deletion." : "Kept the draft.")
  }
  async function onEdit() {
    const edit = createProfileModal(manager, {
      Button,
      Input,
      // The callback uses the public handle, just as a service or external event can.
      onLoadSample: () => handle.update({ name: "Grace", email: "grace@example.com" })
    })
    const handle = edit.open()
    const profile = await handle
    setResult(profile === null ? "Editing cancelled." : `Returned profile: ${JSON.stringify(profile)}`)
  }
  async function onInferredState() {
    const counter = manager.createModal({
      title: "Inferred state",
      initialState: { count: 0 },
      defaultResult: null,
      render: function Counter({ data, controls }) {
        return (
          <div className="modal-example-form">
            <output aria-live="polite">Count: {data.count}</output>
            <div className="actions">
              <Button onClick={() => controls.update((current) => ({ count: current.count + 1 }))}>Increase</Button>
              <Button onClick={() => controls.close(data)}>Return count</Button>
              <Button
                onClick={() => {
                  void controls.dismiss()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )
      }
    })
    const value = await counter.open({ count: 3 })
    setResult(value === null ? "Counter cancelled." : `Returned count: ${value.count}`)
  }
  function onNested() {
    manager.open({
      title: "Draft details",
      description: "The parent stays mounted while a child dialog is open.",
      children: <Button onClick={onConfirm}>Open nested confirmation</Button>
    })
  }
  return (
    <section className="shadcn-demo" aria-label="Modal examples">
      <header>
        <h1>{scenarioTitles[scenario]}</h1>
        <p>
          {scenario === "form"
            ? "Edit fields, load sample values, simulate a failed save, or cancel unsaved changes. The saved object appears below."
            : "Open dialogs from application code. Await typed results and update state while a dialog is open."}
        </p>
      </header>
      <div className="actions">
        {scenario === "all" && (
          <>
            <Button onClick={onConfirm}>Confirmation</Button>
            <Button
              onClick={async () => {
                await manager.alert({ title: "Changes saved", description: "Your profile has been saved." })
                setResult("Alert acknowledged.")
              }}
            >
              Alert
            </Button>
            <Button onClick={onNested}>Nested dialogs</Button>
            <Button
              onClick={() =>
                manager.open({
                  title: "Explicit dismissal",
                  description: "Escape and backdrop clicks are disabled. Use Close to finish.",
                  dismissible: false
                })
              }
            >
              Required action
            </Button>
          </>
        )}
        {scenario !== "state" && <Button onClick={onEdit}>Typed form</Button>}
        {scenario !== "form" && <Button onClick={onInferredState}>Inferred state</Button>}
      </div>
      <output aria-live="polite">{result}</output>
      <p>Stack entries: {entries.length}. Closing entries remain until their exit animation completes.</p>
      {children}
    </section>
  )
}
