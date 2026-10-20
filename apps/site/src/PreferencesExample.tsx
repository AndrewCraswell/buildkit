import { createPreferences, type PreferencesStore } from "@buildkitgg/preferences-core"
import { connectPreferencesStorage } from "@buildkitgg/preferences-core/browser"
import { usePreference } from "@buildkitgg/react-preferences"
import { ArrowUpRight, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "./components/ui/Button"
import { ExampleCode } from "./ExampleCode"
import { links } from "./links"

type ReadingPreferences = { textSize: "small" | "medium" | "large" }
type ReadingPreviewProps = { store: PreferencesStore<ReadingPreferences> }
const textSizes = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
] as const

function ReadingPreview({ store }: ReadingPreviewProps) {
  const [textSize] = usePreference(store, "textSize")
  return (
    <div className="reading-preview" data-text-size={textSize}>
      <div className="demo-toolbar">
        <strong>Reading preview</strong>
      </div>
      <div className="reading-content">
        <h3>Team update</h3>
        <p>
          The new navigation is ready for review. We’re checking the mobile layout and keyboard controls before the next
          release.
        </p>
        <p>Please leave your feedback in the project notes so everyone can follow the discussion.</p>
      </div>
    </div>
  )
}

export function PreferencesExample() {
  const [store] = useState(() => createPreferences<ReadingPreferences>({ defaults: { textSize: "medium" } }))
  const [textSize, setTextSize] = usePreference(store, "textSize")

  // Connect after hydration, with cleanup for StrictMode and unmounting.
  useEffect(() => connectPreferencesStorage(store, { storage: "localStorage", key: "buildkit-reading-demo" }), [store])

  return (
    <article className="behavior-example" aria-labelledby="preferences-example-title">
      <div className="behavior-explanation">
        <h2 id="preferences-example-title">Save a reading preference</h2>
        <p>
          Choose a text size. It’s saved in this browser and restored when you reload the page. Reset removes your saved
          choice and returns to the default.
        </p>
        <a className="text-link" href={`${links.docs}packages/react-preferences/`}>
          Preferences guide <ArrowUpRight aria-hidden="true" />
        </a>
        <ExampleCode label="preferences.ts">
          <span className="syntax-purple">const</span> preferences ={" "}
          <span className="syntax-blue">createPreferences</span>
          {"({\n"}
          {"  defaults: { textSize: "}
          <span className="syntax-string">{'"medium"'}</span>
          {" }\n})\n\n"}
          <span className="syntax-comment">{"// Connect in the browser\n"}</span>
          <span className="syntax-blue">connectPreferencesStorage</span>
          {"(preferences, {\n"}
          {"  storage: "}
          <span className="syntax-string">{'"localStorage"'}</span>
          {",\n"}
          {"  key: "}
          <span className="syntax-string">{'"buildkit-reading-demo"'}</span>
          {"\n})"}
        </ExampleCode>
      </div>
      <div className="behavior-preview preferences-preview">
        <div className="preference-controls">
          <div className="demo-toolbar">
            <strong>Reading preferences</strong>
          </div>
          <fieldset className="text-size-setting">
            <legend>Text size</legend>
            <div className="text-size-buttons">
              {textSizes.map(({ value, label }) => (
                <Button
                  key={value}
                  variant="outline"
                  aria-pressed={textSize === value}
                  onClick={() => setTextSize(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="preference-value">
            <span>Default: Medium</span>
            <Button variant="ghost" size="sm" onClick={() => store.reset("textSize")}>
              <RotateCcw aria-hidden="true" />
              Reset preference
            </Button>
          </div>
        </div>
        <ReadingPreview store={store} />
        <p className="demo-note">Reload the page to try your saved choice. This setting only affects the example.</p>
      </div>
    </article>
  )
}
