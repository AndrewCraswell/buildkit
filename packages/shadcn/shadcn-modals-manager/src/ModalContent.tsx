"use client"

import type { ModalSurfaceOptions, ModalSurfaceProps } from "@buildkitgg/react-modals"
import type { ModalContentComponents } from "./types.js"

type ModalContentProps = ModalSurfaceProps<ModalSurfaceOptions> & {
  components: ModalContentComponents
}

export function ModalContent({ components, entry, body, children }: ModalContentProps) {
  const { DialogTitle, DialogDescription, DialogFooter, Button } = components
  const view = entry.content
  return (
    <>
      <DialogTitle>{view.title}</DialogTitle>
      {view.description && <DialogDescription>{view.description}</DialogDescription>}
      {body}
      {view.actions.length > 0 && (
        <DialogFooter>
          {view.actions.map((action, index) => (
            <Button
              key={index}
              type="button"
              variant={action.appearance === "primary" ? "default" : "outline"}
              onClick={action.onClick}
              disabled={entry.isPending}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      )}
      {children}
    </>
  )
}
