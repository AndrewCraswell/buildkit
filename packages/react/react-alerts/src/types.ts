import type {
  AlertEntry as CoreAlertEntry,
  AlertStore,
  AlertAction as CoreAlertAction,
  AlertOptions as CoreAlertOptions,
  AlertPatch as CoreAlertPatch,
  AlertHandle as CoreAlertHandle
} from "@buildkitgg/alert-core"
import type { ComponentType, ReactNode } from "react"
export type AlertEntry = CoreAlertEntry<ReactNode>
export type AlertAction = CoreAlertAction<ReactNode>
export type AlertOptions = CoreAlertOptions<ReactNode>
export type AlertPatch = CoreAlertPatch<ReactNode>
export type AlertHandle = CoreAlertHandle<ReactNode>
export type AlertRendererProps = { entry: AlertEntry; dismiss(): void; dismissLabel: string }
export type AlertAdapter = { Alert: ComponentType<AlertRendererProps> }
export type AlertManagerOptions = { adapter?: AlertAdapter }
export type AlertManager = AlertStore<ReactNode> & { readonly adapter?: AlertAdapter }
export type { AlertIntent } from "@buildkitgg/alert-core"
