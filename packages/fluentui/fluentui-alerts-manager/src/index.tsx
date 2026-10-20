"use client"
import { createAlertManager as createReactAlertManager } from "@buildkitgg/react-alerts"
import type { AlertManager, AlertManagerOptions, AlertRendererProps } from "@buildkitgg/react-alerts"
import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components"
function Alert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
  return (
    <MessageBar intent={entry.intent}>
      <MessageBarBody>
        <MessageBarTitle>{entry.title}</MessageBarTitle>
        {entry.body}
      </MessageBarBody>
      {(entry.action || entry.dismissible) && (
        <MessageBarActions
          containerAction={
            entry.dismissible ? (
              <Button appearance="transparent" aria-label={dismissLabel} onClick={dismiss}>
                {dismissLabel}
              </Button>
            ) : undefined
          }
        >
          {entry.action && <Button onClick={entry.action.onClick}>{entry.action.label}</Button>}
        </MessageBarActions>
      )}
    </MessageBar>
  )
}
const defaultAdapter = { Alert }
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
