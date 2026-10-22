import type { ModalCloseEvent, ModalManager } from "@buildkitgg/react-modals"
import { useState } from "react"
import type { ComponentType } from "react"
import type { ExampleButtonProps, ExampleInputProps } from "./ModalExamples.js"

export function createQuantityModal<TSurface>(
  manager: ModalManager<TSurface>,
  Button: ComponentType<ExampleButtonProps>
) {
  return manager.createModal({
    title: "Adjust quantity",
    initialState: { count: 0 },
    defaultResult: null,
    body: {
      component: function Counter({ data, controls }) {
        return (
          <div className="modal-example-form">
            <output aria-live="polite">Count: {data.count}</output>
            <div className="actions">
              <Button
                variant="outline"
                onClick={() => controls.update((current) => ({ data: { count: current.data.count + 1 } }))}
              >
                Increase
              </Button>
              <Button onClick={() => controls.close(data)}>Return count</Button>
              <Button
                variant="outline"
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
    }
  })
}

export function createPreviewModal<TSurface>(
  manager: ModalManager<TSurface>,
  {
    Button,
    Input,
    onClose
  }: {
    Button: ComponentType<ExampleButtonProps>
    Input: ComponentType<ExampleInputProps>
    onClose(event: ModalCloseEvent<{ count: number } | null>): void
  }
) {
  return manager.createModal({
    title: <span>Draft preview</span>,
    initialState: { count: 0 },
    defaultResult: null,
    body: {
      component: function Preview({ data, controls }) {
        const [note, setNote] = useState("")
        return (
          <div className="modal-example-form">
            <label htmlFor={`${controls.id}-note`}>Preview note</label>
            <Input id={`${controls.id}-note`} value={note} onChange={setNote} />
            <p aria-live="polite">Revisions: {data.count}</p>
          </div>
        )
      }
    },
    footer: {
      component: function Footer({ data, controls }) {
        const updatedTitle = <strong>Updated preview</strong>
        const reviewedBody = <p>Reviewed {data.count} revisions.</p>
        const publishFooter = <Button onClick={() => controls.close(data)}>Publish draft</Button>
        return (
          <div className="actions">
            <Button
              variant="outline"
              onClick={() => {
                controls.update({ title: updatedTitle, data: { count: data.count + 1 } })
              }}
            >
              Revise preview
            </Button>
            <Button
              onClick={() => {
                controls.update({
                  title: "Ready to publish",
                  body: reviewedBody,
                  footer: publishFooter
                })
              }}
            >
              Review draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void controls.dismiss()
              }}
            >
              Cancel
            </Button>
          </div>
        )
      }
    },
    onClose
  })
}
