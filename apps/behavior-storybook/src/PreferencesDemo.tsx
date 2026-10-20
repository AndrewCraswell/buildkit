import { createPreferences } from "@buildkitgg/preferences-core"
import { connectPreferencesStorage } from "@buildkitgg/preferences-core/browser"
import { usePreference } from "@buildkitgg/react-preferences"
import { Button, Input, Label, Textarea, NativeSelect, NativeSelectOption } from "@buildkitgg/shadcn-baseui-kit"
import { ExampleResult } from "@repo/storybook-config/examples"
import { useEffect, useState } from "react"
export type PreferenceScenario = "defaults" | "optional" | "local" | "session" | "json"
type AppPreferences = { pageSize: number; displayName: string }
export function PreferencesDemo({ scenario = "defaults" }: { scenario?: PreferenceScenario }) {
  const [preferences] = useState(() => createPreferences<AppPreferences>({ defaults: { pageSize: 25 } }))
  useEffect(() => {
    if (scenario === "local" || scenario === "session") {
      return connectPreferencesStorage(preferences, {
        storage: scenario === "local" ? "localStorage" : "sessionStorage",
        key: "buildkit-example-" + scenario
      })
    }
  }, [preferences, scenario])
  const [pageSize, setPageSize] = usePreference(preferences, "pageSize")
  const [displayName, setDisplayName] = usePreference(preferences, "displayName")
  const [json, setJson] = useState('{"pageSize":50}')
  const [message, setMessage] = useState("No import applied")
  let resultLabel = "Rows per page"
  let result: string | number | undefined = pageSize
  if (scenario === "json") {
    resultLabel = "Import / export"
    result = message
  } else if (scenario === "optional") {
    resultLabel = "Current value"
    result = displayName === undefined ? "undefined" : JSON.stringify(displayName)
  }
  function onImport() {
    try {
      preferences.importJson(json)
      setMessage("Preferences imported")
    } catch {
      setMessage("Invalid JSON. Enter an object with valid preference values.")
    }
  }
  return (
    <section>
      <div className="bk-settings">
        {scenario === "optional" ? (
          <>
            <div className="bk-field">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                placeholder="Enter your name"
                value={displayName ?? ""}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="actions">
              <Button variant="outline" onClick={() => preferences.reset("displayName")}>
                Reset name
              </Button>
            </div>
          </>
        ) : (
          <div className="bk-setting-row">
            <div>
              <p className="bk-item-title">Rows per page</p>
              <p className="bk-item-description">Choose how many projects appear in a list.</p>
            </div>
            <NativeSelect
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              <NativeSelectOption value={10}>10 rows</NativeSelectOption>
              <NativeSelectOption value={25}>25 rows</NativeSelectOption>
              <NativeSelectOption value={50}>50 rows</NativeSelectOption>
            </NativeSelect>
          </div>
        )}
        {scenario === "json" && (
          <>
            <div className="bk-field">
              <Label htmlFor="preferences-json">Preference overrides</Label>
              <Textarea id="preferences-json" value={json} onChange={(event) => setJson(event.target.value)} rows={3} />
            </div>
            <div className="actions">
              <Button onClick={onImport}>Import JSON</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setJson(preferences.exportJson())
                  setMessage("Current overrides exported")
                }}
              >
                Export JSON
              </Button>
            </div>
          </>
        )}
        {scenario !== "optional" && scenario !== "json" && (
          <div className="actions">
            <Button variant="outline" onClick={() => preferences.reset("pageSize")}>
              Restore default
            </Button>
          </div>
        )}
      </div>
      <ExampleResult label={resultLabel}>{result}</ExampleResult>
    </section>
  )
}
