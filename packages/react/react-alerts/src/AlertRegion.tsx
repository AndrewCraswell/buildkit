import type { AlertManager } from "./types.js"
import { useAlerts } from "./useAlerts.js"
export type AlertRegionProps = {
  manager: AlertManager
  region?: string
  label?: string
  dismissLabel?: string
  className?: string
}
/** Mount once per manager/region. Surfaces own their live announcements; the container is only a landmark. */
export function AlertRegion({
  manager,
  region = "default",
  label = "Notifications",
  dismissLabel = "Dismiss",
  className
}: AlertRegionProps) {
  const entries = useAlerts(manager, region)
  const Alert = manager.adapter?.Alert
  if (!Alert) {
    throw new Error("AlertRegion requires a manager with an adapter")
  }
  return (
    <section aria-label={label} className={className}>
      {entries.map((entry) => (
        <Alert
          key={entry.key}
          entry={entry}
          dismissLabel={dismissLabel}
          dismiss={() => {
            if (manager.getSnapshot(region).some((current) => current.key === entry.key)) {
              manager.dismiss(entry.id, region)
            }
          }}
        />
      ))}
    </section>
  )
}
