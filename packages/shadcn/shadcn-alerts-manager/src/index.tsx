"use client"
import { createAlertManager as createReactAlertManager } from "@buildkitgg/react-alerts"
import type { AlertManager, AlertManagerOptions } from "@buildkitgg/react-alerts"
import { Alert, AlertTitle, AlertDescription, Button } from "@buildkitgg/shadcn-baseui-kit"
import { alertComponents } from "./alertComponents.js"
const defaultAdapter = alertComponents({ Alert, AlertTitle, AlertDescription, Button })
export function createAlertManager(options: AlertManagerOptions = {}): AlertManager {
  return createReactAlertManager({ ...options, adapter: options.adapter ?? defaultAdapter })
}
export { AlertRegion, useAlerts } from "@buildkitgg/react-alerts"
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
