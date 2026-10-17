"use client"

import {
  createModalManager as createReactModalManager,
  ModalRenderer as ReactModalRenderer
} from "@buildkitgg/react-modals"
import type { ModalManagerOptions, ModalSurfaceOptions } from "@buildkitgg/react-modals"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle
} from "@buildkitgg/shadcn-baseui-kit"
import { baseUiComponents } from "./baseUiComponents.js"
import type { ModalManager, ModalRendererProps } from "./types.js"

const defaultAdapter = baseUiComponents({ Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle })

export function createModalManager(options?: ModalManagerOptions): ModalManager {
  return createReactModalManager<ModalSurfaceOptions>({ ...options, adapter: options?.adapter ?? defaultAdapter })
}

/** Renders the manager's adapter. Default components use the package stylesheet. */
export function ModalRenderer(props: ModalRendererProps) {
  return <ReactModalRenderer {...props} />
}

export { baseUiComponents } from "./baseUiComponents.js"
export { radixComponents } from "./radixComponents.js"
export type {
  ModalManager,
  ModalRendererProps,
  ModalAdapter,
  BaseUiModalComponents,
  RadixModalComponents
} from "./types.js"
export { useModals } from "@buildkitgg/react-modals"
export type {
  ModalBodyProps,
  ModalControls,
  ModalHandle,
  ModalDefinition,
  ModalLabels,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalStateUpdate,
  CreateModalOptions
} from "@buildkitgg/react-modals"
