"use client"

import { useModalExit } from "@buildkitgg/react-modals"
import type { ModalSurfaceOptions, ModalSurfaceProps } from "@buildkitgg/react-modals"
import { ModalContent } from "./ModalContent.js"
import type { BaseUiModalComponents, ModalAdapter } from "./types.js"

export function baseUiComponents(components: BaseUiModalComponents): ModalAdapter {
  const { Dialog, DialogContent } = components
  function Surface(props: ModalSurfaceProps<ModalSurfaceOptions>) {
    const { entry } = props
    const view = entry.content
    useModalExit(entry)
    return (
      <Dialog
        open={entry.status === "open"}
        onOpenChange={(isOpen) => {
          if (!isOpen && view.dismissible !== false) {
            void entry.dismiss()
          }
        }}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) {
            entry.finishExit()
          }
        }}
      >
        <DialogContent
          {...view.surfaceProps}
          showCloseButton={false}
          aria-busy={entry.isPending || undefined}
          finalFocus={() => view.returnFocus}
        >
          <ModalContent {...props} components={components} />
        </DialogContent>
      </Dialog>
    )
  }
  return { Surface }
}
