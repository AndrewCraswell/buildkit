"use client"

import {
  createModalManager as createReactModalManager,
  ModalRenderer as ReactModalRenderer,
  useModalExit
} from "@buildkitgg/react-modals"
import type {
  ModalManager as ReactModalManager,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalDefaultFooterProps,
  ModalSurfaceProps
} from "@buildkitgg/react-modals"
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle
} from "@fluentui/react-components"
import { useId } from "react"

export type ModalManager = ReactModalManager<ModalSurfaceOptions>

export function createModalManager(options?: ModalManagerOptions): ModalManager {
  return createReactModalManager<ModalSurfaceOptions>({ ...options, adapter: options?.adapter ?? defaultAdapter })
}

function ModalSurface({ entry, title, body, footer, children }: ModalSurfaceProps<ModalSurfaceOptions>) {
  const descriptionId = useId()
  useModalExit(entry)
  const view = entry.content
  return (
    <Dialog
      open={entry.status === "open"}
      onOpenChange={(_, data) => {
        if (!data.open && view.dismissible !== false) {
          entry.dismiss()
        }
      }}
      surfaceMotion={{
        onMotionFinish: (_, data) => {
          if (data.direction === "exit") {
            if (view.returnFocus?.isConnected) {
              view.returnFocus.focus()
            }
            entry.finishExit()
          }
        }
      }}
    >
      <DialogSurface
        {...view.surfaceProps}
        aria-describedby={view.description ? descriptionId : undefined}
        aria-busy={entry.isPending || undefined}
        aria-label={view.ariaLabel}
        {...(view.ariaLabel ? { "aria-labelledby": undefined } : {})}
      >
        <DialogBody>
          <DialogTitle style={title === null || title === undefined ? { display: "none" } : undefined}>
            {title}
          </DialogTitle>
          <DialogContent>
            {view.description && <p id={descriptionId}>{view.description}</p>}
            {body}
          </DialogContent>
          {footer !== null && footer !== undefined && <DialogActions fluid>{footer}</DialogActions>}
          {children}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function DefaultFooter({ kind, labels, isPending, dismiss, confirm }: ModalDefaultFooterProps) {
  return (
    <>
      <Button appearance="secondary" onClick={dismiss} disabled={isPending}>
        {kind === "confirm" ? labels.cancel : labels.close}
      </Button>
      {kind === "confirm" && (
        <Button appearance="primary" onClick={confirm} disabled={isPending}>
          {labels.confirm}
        </Button>
      )}
    </>
  )
}

const defaultAdapter = { Surface: ModalSurface, DefaultFooter }

export type ModalRendererProps = { manager: ModalManager }
/** Renders the manager's adapter. The default surface needs a FluentProvider. */
export function ModalRenderer({ manager }: ModalRendererProps) {
  return <ReactModalRenderer manager={manager} />
}

export { useModals } from "@buildkitgg/react-modals"
export type {
  ModalSlotProps,
  ModalAdapter,
  ModalControls,
  ModalHandle,
  ModalDefinition,
  ModalLabels,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalStateUpdate,
  ModalSlot,
  ModalSlots,
  ModalRenderedSlots,
  ModalDefaultFooterProps,
  StandardModalSlotProps,
  StandardModalOptions,
  ModalCloseEvent,
  ModalCloseReason,
  ModalState,
  ModalUpdate,
  StandardModalHandle,
  CreateModalOptions
} from "@buildkitgg/react-modals"
