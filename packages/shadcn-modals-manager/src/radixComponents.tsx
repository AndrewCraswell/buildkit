"use client"

import { useModalExit } from "@buildkitgg/react-modals"
import type { ModalSurfaceOptions, ModalSurfaceProps } from "@buildkitgg/react-modals"
import { ModalContent } from "./ModalContent.js"
import type { ModalAdapter, RadixModalComponents } from "./types.js"

export function radixComponents(components: RadixModalComponents): ModalAdapter {
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
      >
        <DialogContent
          {...view.surfaceProps}
          showCloseButton={false}
          aria-busy={entry.isPending || undefined}
          {...(view.description ? {} : { "aria-describedby": undefined })}
          onCloseAutoFocus={(event) => {
            // Radix runs this after Presence unmounts, including CSS exit animations.
            // Ignore StrictMode's simulated cleanup while the entry is still open.
            event.preventDefault()
            if (entry.status !== "closing" || (event.target instanceof HTMLElement && event.target.isConnected)) {
              return
            }
            if (view.returnFocus?.isConnected) {
              view.returnFocus.focus()
            }
            entry.finishExit()
          }}
        >
          <ModalContent {...props} components={components} />
        </DialogContent>
      </Dialog>
    )
  }
  return { Surface }
}
