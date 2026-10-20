import type { AlertAdapter, AlertRendererProps } from "@buildkitgg/react-alerts"
import type { ComponentType, HTMLAttributes, ReactNode } from "react"
export type AlertComponents = {
  Alert: ComponentType<HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }>
  AlertTitle: ComponentType<{ children?: ReactNode }>
  AlertDescription: ComponentType<{ children?: ReactNode }>
  Button: ComponentType<{
    children?: ReactNode
    type?: "button"
    variant?: "outline" | "ghost"
    onClick?(): void
    "aria-label"?: string
  }>
}
/** Structural component contract works with Base UI and Radix shadcn registry components. */
export function alertComponents({ Alert, AlertTitle, AlertDescription, Button }: AlertComponents): AlertAdapter {
  function RenderAlert({ entry, dismiss, dismissLabel }: AlertRendererProps) {
    return (
      <Alert
        role={entry.intent === "error" || entry.intent === "warning" ? "alert" : "status"}
        variant={entry.intent === "error" ? "destructive" : "default"}
        data-intent={entry.intent}
      >
        <AlertTitle>{entry.title}</AlertTitle>
        <AlertDescription>
          <div>{entry.body}</div>
          {(entry.action || entry.dismissible) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.action && (
                <Button type="button" variant="outline" onClick={entry.action.onClick}>
                  {entry.action.label}
                </Button>
              )}
              {entry.dismissible && (
                <Button type="button" variant="ghost" aria-label={dismissLabel} onClick={dismiss}>
                  {dismissLabel}
                </Button>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }
  return { Alert: RenderAlert }
}
