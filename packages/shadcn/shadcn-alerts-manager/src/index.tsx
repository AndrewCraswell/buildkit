"use client"
import {
  createAlertManager as createReactAlertManager,
  AlertRegion as ReactAlertRegion
} from "@buildkitgg/react-alerts"
import type { AlertManager, AlertManagerOptions, AlertRegionProps } from "@buildkitgg/react-alerts"
import { Alert, AlertTitle, AlertDescription, Button, useShadcnLocalization } from "@buildkitgg/shadcn-baseui-kit"
import { alertComponents } from "./alertComponents.js"
const defaultAdapter = alertComponents({ Alert, AlertTitle, AlertDescription, Button })
export function createAlertManager(options: AlertManagerOptions = {}): AlertManager {
  return createReactAlertManager({ ...options, adapter: options.adapter ?? defaultAdapter })
}
export function AlertRegion(props: AlertRegionProps) {
  const { strings } = useShadcnLocalization()
  return (
    <ReactAlertRegion
      {...props}
      label={props.label ?? strings.notifications}
      dismissLabel={props.dismissLabel ?? strings.dismiss}
    />
  )
}
export { useAlerts } from "@buildkitgg/react-alerts"
export type {
  AlertRegionProps,
  AlertManager,
  AlertManagerOptions,
  AlertAdapter,
  AlertRendererProps,
  AlertOptions,
  AlertPatch,
  AlertHandle,
  AlertIntent,
  AlertEntry,
  AlertAction
} from "@buildkitgg/react-alerts"
export { alertComponents, type AlertComponents } from "./alertComponents.js"
