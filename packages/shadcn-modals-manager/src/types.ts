import type { ModalManager as ReactModalManager, ModalSurfaceOptions } from "@buildkitgg/react-modals"
import type { AriaAttributes, ComponentType, MouseEventHandler, ReactNode } from "react"

export type ModalManager = ReactModalManager<ModalSurfaceOptions>
export type ModalRendererProps = { manager: ModalManager }
export type { ModalAdapter } from "@buildkitgg/react-modals"

/** Only the props the adapter supplies, so wrapped registry components remain compatible. */
export type ModalContentComponents = {
  DialogTitle: ComponentType<{ children?: ReactNode }>
  DialogDescription: ComponentType<{ children?: ReactNode; id?: string }>
  DialogFooter: ComponentType<{ children?: ReactNode }>
  Button: ComponentType<{
    children?: ReactNode
    variant?: "default" | "outline"
    onClick?: MouseEventHandler<HTMLButtonElement>
    type?: "button"
    disabled?: boolean
  }>
}

type DialogProps = { children?: ReactNode; open?: boolean; onOpenChange?(isOpen: boolean): void }
type DialogContentProps = ModalSurfaceOptions & AriaAttributes & { children?: ReactNode; showCloseButton?: boolean }

export type BaseUiModalComponents = ModalContentComponents & {
  Dialog: ComponentType<DialogProps & { onOpenChangeComplete?(isOpen: boolean): void }>
  DialogContent: ComponentType<DialogContentProps & { finalFocus?: () => HTMLElement | undefined }>
}

export type RadixModalComponents = ModalContentComponents & {
  Dialog: ComponentType<DialogProps>
  DialogContent: ComponentType<DialogContentProps & { onCloseAutoFocus?(event: Event): void }>
}
