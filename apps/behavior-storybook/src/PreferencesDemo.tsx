import { createPreferences } from "@buildkitgg/preferences-core"
import { usePreference } from "@buildkitgg/react-preferences"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
  Textarea
} from "@buildkitgg/shadcn-baseui-kit"
import { useState } from "react"

type AppPreferences = { pageSize: number; displayName: string }
const preferences = createPreferences<AppPreferences>({
  defaults: { pageSize: 25 },
  storage: "localStorage",
  key: "buildkit-preferences-preview"
})
const session = createPreferences({
  defaults: { compact: false },
  storage: "sessionStorage",
  key: "buildkit-session-preview"
})

export function PreferencesDemo() {
  const [pageSize, setPageSize] = usePreference(preferences, "pageSize")
  const [displayName, setDisplayName] = usePreference(preferences, "displayName")
  const [compact, setCompact] = usePreference(session, "compact")
  const [json, setJson] = useState("{}")
  const [message, setMessage] = useState("")
  function importJson(mode: "merge" | "replace") {
    try {
      preferences.importJson(json, { mode })
      setMessage(mode === "merge" ? "Preferences merged." : "Preferences replaced.")
    } catch {
      setMessage("Could not import preferences. Use a JSON object with valid value types.")
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>App defaults and your choices, with JSON backup and restore.</CardDescription>
      </CardHeader>
      <CardContent className="preference-fields">
        <Label htmlFor="display-name">Display name (no default)</Label>
        <Input id="display-name" value={displayName ?? ""} onChange={(event) => setDisplayName(event.target.value)} />
        <p>Display name: {displayName === undefined ? "Not set" : displayName}</p>
        <div className="actions">
          <Button variant="outline" onClick={() => setPageSize(pageSize === 50 ? 25 : 50)}>
            Rows per page: {pageSize}
          </Button>
          <Button variant="outline" aria-pressed={compact ?? false} onClick={() => setCompact(!compact)}>
            Compact view (this tab)
          </Button>
        </div>
        <Label htmlFor="preferences-json">Preferences JSON</Label>
        <Textarea id="preferences-json" value={json} onChange={(event) => setJson(event.target.value)} rows={4} />
        <div className="actions">
          <Button
            variant="outline"
            onClick={() => {
              setJson(preferences.exportJson())
              setMessage("User overrides exported.")
            }}
          >
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => importJson("merge")}>
            Merge JSON
          </Button>
          <Button variant="outline" onClick={() => importJson("replace")}>
            Replace from JSON
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              preferences.resetAll()
              setMessage("Preferences reset to defaults.")
            }}
          >
            Reset preferences
          </Button>
        </div>
        <output aria-live="polite">{message}</output>
      </CardContent>
    </Card>
  )
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    preferences.dispose()
    session.dispose()
  })
}
