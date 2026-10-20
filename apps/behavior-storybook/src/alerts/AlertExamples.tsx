import { useAlerts, type AlertManager, type AlertRegionProps } from "@buildkitgg/react-alerts"
import { ExampleResult } from "@repo/storybook-config/examples"
import type { ComponentType, ReactNode } from "react"
import { useState } from "react"
export type AlertScenario = "dismiss" | "replace" | "action" | "regions" | "silent"
export function alertStory(scenario: AlertScenario) {
  const descriptions = {
    dismiss: "Show a persistent notification, then dismiss it with its close action.",
    replace: "Reuse an alert ID to replace its content without adding another message.",
    action: "Attach an Undo action that updates the notification in place.",
    regions: "Send notifications to independent workspace and billing regions.",
    silent: "Clear notifications without invoking their dismissal callbacks."
  }
  return { args: { scenario }, parameters: { docs: { description: { story: descriptions[scenario] } } } }
}
export type AlertExamplesProps = {
  manager: AlertManager
  Region: ComponentType<AlertRegionProps>
  Button: ComponentType<{ children?: ReactNode; onClick?(): void }>
  scenario?: AlertScenario
}
export function AlertExamples({ manager, Region, Button, scenario = "dismiss" }: AlertExamplesProps) {
  const [dismissals, setDismissals] = useState(0)
  const entries = useAlerts(manager)
  function onSave() {
    manager.success({
      id: "save",
      title: "Changes saved",
      body: "Workspace preferences are up to date.",
      onDismiss: () => setDismissals((count) => count + 1),
      action:
        scenario === "action"
          ? {
              label: "Undo",
              onClick: () =>
                manager.update("save", {
                  title: "Changes restored",
                  body: "The previous preferences are active.",
                  intent: "info",
                  action: undefined
                })
            }
          : undefined
    })
  }
  return (
    <section>
      <div className="bk-stack">
        <div className="bk-row">
          <div>
            <p className="bk-item-title">Workspace preferences</p>
            <p className="bk-item-description">Notifications for your team</p>
          </div>
          <div className="actions">
            <Button onClick={onSave}>Save changes</Button>
            {scenario === "replace" && (
              <Button
                onClick={() =>
                  manager.error({
                    id: "save",
                    title: "Could not save changes",
                    body: "Check your connection and try again."
                  })
                }
              >
                Replace with error
              </Button>
            )}
            {scenario === "silent" && <Button onClick={() => manager.flush()}>Clear silently</Button>}
          </div>
        </div>
        {entries.length > 0 ? (
          <Region manager={manager} label="Workspace notifications" className="bk-alert-list" />
        ) : (
          <div className="bk-empty">No workspace notifications</div>
        )}
        {scenario === "regions" && (
          <section className="bk-region">
            <div className="bk-row">
              <h2 className="bk-region-label">Billing region</h2>
              <Button
                onClick={() =>
                  manager.warning(
                    {
                      id: "billing",
                      title: "Payment method expires soon",
                      body: "Update your payment method in billing settings."
                    },
                    "billing"
                  )
                }
              >
                Check billing
              </Button>
            </div>
            <Region manager={manager} region="billing" label="Billing notifications" className="bk-alert-list" />
          </section>
        )}
      </div>
      <ExampleResult
        label={scenario === "dismiss" || scenario === "silent" ? "Dismissal callbacks" : "Workspace alerts"}
      >
        {scenario === "dismiss" || scenario === "silent" ? dismissals : entries.length}
      </ExampleResult>
    </section>
  )
}
