import type { ModalManager } from "@buildkitgg/react-modals"
import { ExampleResult } from "@repo/storybook-config/examples"
import { useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { createPreviewModal, createQuantityModal } from "./createExampleModals.js"
import { createProfileModal } from "./createProfileModal.js"

export type ExampleButtonProps = {
  children?: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
  variant?: "default" | "outline"
}
export type ExampleInputProps = {
  id: string
  value: string
  onChange(value: string): void
  type?: "email" | "text"
  disabled?: boolean
  required?: boolean
}
export type ModalScenario =
  | "confirmation"
  | "alert"
  | "nested"
  | "required"
  | "form"
  | "state"
  | "async"
  | "guard"
  | "external"
  | "slots"
export type ModalExampleScenario = { scenario?: ModalScenario }
const modalDescriptions = {
  confirmation: "Await a boolean result from a confirmation dialog. Cancel keeps the draft.",
  alert: "Wait for an acknowledgment before continuing an application workflow.",
  nested: "Open a confirmation from another dialog without losing the parent.",
  required: "Keep a dialog open until its explicit close action is used.",
  form: "Edit a profile and return the saved object to the caller.",
  state: "Pass initial values into a modal and return its updated state.",
  async: "Keep the form open after a failed save, then retry without losing edits.",
  guard: "Confirm before discarding unsaved profile changes.",
  external: "Update an open form from application code through its handle.",
  slots: "Replace the title, body and footer while keeping control of your own buttons."
}
export function modalStory(scenario: ModalScenario) {
  const sources: Partial<Record<ModalScenario, string>> = {
    confirmation:
      'const confirmed = await modals.confirm({\n  title: "Delete draft?",\n  confirmLabel: "Delete",\n  cancelLabel: "Keep draft"\n})',
    form: "const profile = await editProfile.open()\nif (profile !== null) {\n  saveProfile(profile)\n}"
  }
  return {
    args: { scenario },
    parameters: {
      docs: {
        description: { story: modalDescriptions[scenario] },
        source: {
          code: sources[scenario]
        }
      }
    }
  }
}

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
  scenario = "confirmation"
}: ModalExamplesProps<TSurface>) {
  const [result, setResult] = useState("Awaiting an action")
  const isProfile = ["form", "async", "guard", "external"].includes(scenario)
  let itemTitle = "Website launch"
  let itemDescription = "Draft proposal"
  if (isProfile) {
    itemTitle = "Ada Lovelace"
    itemDescription = "ada@example.com"
  } else if (scenario === "state") {
    itemTitle = "Project licenses"
    itemDescription = "3 seats selected"
  }
  async function onConfirm() {
    const confirmed = await manager.confirm({
      title: "Delete draft?",
      description: "The draft will be removed.",
      confirmLabel: "Delete",
      cancelLabel: "Keep draft"
    })
    setResult(String(confirmed))
  }
  async function onEdit() {
    const edit = createProfileModal(manager, {
      Button,
      Input,
      mode: scenario,
      // The callback uses the public handle, just as a service or external event can.
      onLoadSample: () => {
        handle.update({
          title: "Edit Grace's profile",
          description: "Review the sample profile before saving.",
          data: { name: "Grace", email: "grace@example.com" }
        })
      }
    })
    const handle = edit.open()
    const profile = await handle
    setResult(profile === null ? "Editing cancelled." : `Returned profile: ${JSON.stringify(profile)}`)
  }
  async function onInferredState() {
    const counter = createQuantityModal(manager, Button)
    const value = await counter.open({ count: 3 })
    setResult(value === null ? "Counter cancelled." : `Returned count: ${value.count}`)
  }
  async function onSlots() {
    const preview = createPreviewModal(manager, {
      Button,
      Input,
      onClose: ({ reason, result: value }) => setResult(`Closed: ${reason}; revisions: ${value?.count ?? "cancelled"}`)
    })
    await preview.open()
  }
  function onNested() {
    manager.open({
      title: "Draft details",
      description: "The parent stays mounted while a child dialog is open.",
      body: <Button onClick={onConfirm}>Open nested confirmation</Button>
    })
  }
  return (
    <section>
      <div className="bk-row">
        <div className="bk-person">
          <div className="bk-avatar" aria-hidden="true">
            {isProfile ? "AL" : "↗"}
          </div>
          <div>
            <p className="bk-item-title">{itemTitle}</p>
            <p className="bk-item-description">{itemDescription}</p>
          </div>
        </div>
        {scenario === "confirmation" && <Button onClick={onConfirm}>Delete draft</Button>}
        {scenario === "alert" && (
          <Button
            onClick={async () => {
              await manager.alert({ title: "Export ready", description: "Your project export is ready to download." })
              setResult("Acknowledged")
            }}
          >
            Show acknowledgment
          </Button>
        )}
        {scenario === "nested" && <Button onClick={onNested}>View draft</Button>}
        {scenario === "required" && (
          <Button
            onClick={async () => {
              await manager.open({
                title: "Review required",
                description: "Use Close to finish. Escape and backdrop dismissal are disabled.",
                dismissible: false
              })
              setResult("Review completed")
            }}
          >
            Review draft
          </Button>
        )}
        {isProfile && <Button onClick={onEdit}>Edit profile</Button>}
        {scenario === "state" && <Button onClick={onInferredState}>Adjust seats</Button>}
        {scenario === "slots" && <Button onClick={onSlots}>Preview draft</Button>}
      </div>
      <ExampleResult label="Returned value">{result}</ExampleResult>
      {children}
    </section>
  )
}
