"use client"

import type { ModalSurfaceOptions, ModalSurfaceProps } from "@buildkitgg/react-modals"
import type { ModalContentComponents } from "./types.js"

type ModalContentProps = ModalSurfaceProps<ModalSurfaceOptions> & { components: ModalContentComponents }

export function ModalContent({ components, entry, title, body, footer, children }: ModalContentProps) {
  const { DialogTitle, DialogDescription, DialogFooter } = components
  const view = entry.content
  return (
    <>
      <DialogTitle style={title === null || title === undefined ? { display: "none" } : undefined}>{title}</DialogTitle>
      {view.description && <DialogDescription>{view.description}</DialogDescription>}
      {body}
      {footer !== null && footer !== undefined && <DialogFooter>{footer}</DialogFooter>}
      {children}
    </>
  )
}
