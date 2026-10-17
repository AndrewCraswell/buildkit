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

function ModalSurface({ entry, body, children }: ModalSurfaceProps<ModalSurfaceOptions>) {
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
      >
        <DialogBody>
          <DialogTitle>{view.title}</DialogTitle>
          <DialogContent>
            {view.description && <p id={descriptionId}>{view.description}</p>}
            {body}
          </DialogContent>
          {view.actions.length > 0 && (
            <DialogActions>
              {view.actions.map((action, index) => (
                <Button key={index} appearance={action.appearance} onClick={action.onClick} disabled={entry.isPending}>
                  {action.label}
                </Button>
              ))}
            </DialogActions>
          )}
          {children}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

const defaultAdapter = { Surface: ModalSurface }

export type ModalRendererProps = { manager: ModalManager }
/** Renders the manager's adapter. The default surface needs a FluentProvider. */
export function ModalRenderer({ manager }: ModalRendererProps) {
  return <ReactModalRenderer manager={manager} />
}

export { useModals } from "@buildkitgg/react-modals"
export type {
  ModalBodyProps,
  ModalAdapter,
  ModalControls,
  ModalHandle,
  ModalDefinition,
  ModalLabels,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalStateUpdate,
  CreateModalOptions
} from "@buildkitgg/react-modals"
