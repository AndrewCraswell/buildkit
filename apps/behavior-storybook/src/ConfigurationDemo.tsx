import { createPreferences } from "@buildkitgg/preferences-core"
import { createConfiguration, type ReactConfigurationClient } from "@buildkitgg/react-configuration"
import { usePreference } from "@buildkitgg/react-preferences"
import { Button, NativeSelect, NativeSelectOption } from "@buildkitgg/shadcn-baseui-kit"
import { ExampleResult } from "@repo/storybook-config/examples"
import { useEffect, useState } from "react"

type Settings = { newCheckout: boolean; defaultLanguage: string }
type Context = { cohort: string }
type Client = ReactConfigurationClient<Settings, Context>
export type ConfigurationScenario = "loading" | "targeting" | "overrides" | "failure" | "language"

export function ConfigurationDemo({ scenario }: { scenario: ConfigurationScenario }) {
  const [client, setClient] = useState<Client | null>(null)
  useEffect(() => {
    let shouldFail = scenario === "failure"
    const next = createConfiguration({
      defaults: { newCheckout: false, defaultLanguage: "en" },
      context: { cohort: "early-access" },
      overrides: scenario === "overrides",
      provider: {
        async load(context, { signal }) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 650)
            signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timer)
                reject(new Error("Cancelled"))
              },
              { once: true }
            )
          })
          if (shouldFail) {
            shouldFail = false
            throw new Error("Unable to reach the configuration provider.")
          }
          return { newCheckout: context.cohort === "early-access", defaultLanguage: "fr" }
        }
      }
    })
    // The effect owns this disposable external client; Strict Mode must create a fresh instance.
    // oxlint-disable-next-line react/set-state-in-effect
    setClient(next)
    if (scenario !== "loading") {
      void next.refresh()
    }
    return () => next.dispose()
  }, [scenario])
  return client ? <ConfigurationExample client={client} scenario={scenario} /> : <output>Preparing example...</output>
}

function ConfigurationExample({ client, scenario }: { client: Client; scenario: ConfigurationScenario }) {
  const setting = client.useSetting("newCheckout")
  const language = client.useSetting("defaultLanguage")
  const snapshot = client.useConfiguration()
  const [preferences] = useState(() => createPreferences<{ language: string }>())
  const [selectedLanguage, setLanguage] = usePreference(preferences, "language")
  if (scenario === "language") {
    const effectiveLanguage = selectedLanguage ?? language.value
    return (
      <section>
        <div className="bk-settings">
          <p className="bk-item-title">Application language</p>
          <p className="bk-item-description">
            Configuration supplies French as the app default. A user&apos;s saved preference takes priority without
            changing configuration.
          </p>
          <NativeSelect
            aria-label="Language preference"
            value={selectedLanguage ?? ""}
            onChange={(event) => {
              if (event.target.value) {
                setLanguage(event.target.value)
              } else {
                preferences.reset("language")
              }
            }}
          >
            <NativeSelectOption value="">Use app default</NativeSelectOption>
            <NativeSelectOption value="en">English</NativeSelectOption>
            <NativeSelectOption value="fr">French</NativeSelectOption>
          </NativeSelect>
          <p>
            Configured default: {language.value} ({language.source}). User preference: {selectedLanguage ?? "not set"}.
          </p>
        </div>
        <ExampleResult label="Effective language">
          <output>{effectiveLanguage === "fr" ? "Bonjour" : "Hello"}</output>
        </ExampleResult>
      </section>
    )
  }
  return (
    <section>
      <div className="bk-settings">
        <div className="bk-setting-row">
          <div>
            <p className="bk-item-title">Checkout rollout</p>
            <p className="bk-item-description">
              The new checkout is enabled for the early-access cohort. Other users keep the existing checkout.
            </p>
          </div>
          <Button disabled={!setting.value}>Try new checkout</Button>
        </div>
        {scenario === "targeting" && (
          <div className="actions" aria-label="Rollout cohort">
            <Button
              variant={snapshot.context.cohort === "standard" ? "default" : "outline"}
              aria-pressed={snapshot.context.cohort === "standard"}
              onClick={() => {
                void client.setContext({ cohort: "standard" })
              }}
            >
              Standard cohort
            </Button>
            <Button
              variant={snapshot.context.cohort === "early-access" ? "default" : "outline"}
              aria-pressed={snapshot.context.cohort === "early-access"}
              onClick={() => {
                void client.setContext({ cohort: "early-access" })
              }}
            >
              Early-access cohort
            </Button>
          </div>
        )}
        {scenario === "overrides" && (
          <div className="actions">
            <Button variant="outline" onClick={() => client.override("newCheckout", false)}>
              Force off
            </Button>
            <Button variant="outline" onClick={() => client.override("newCheckout", true)}>
              Force on
            </Button>
            <Button variant="outline" onClick={() => client.reset("newCheckout")}>
              Use provider value
            </Button>
          </div>
        )}
        {(scenario === "loading" || scenario === "failure") && (
          <Button
            disabled={snapshot.status === "loading"}
            onClick={() => {
              void client.refresh()
            }}
          >
            {snapshot.status === "error" ? "Retry evaluation" : "Load provider values"}
          </Button>
        )}
        {snapshot.error && <p role="alert">{snapshot.error.message} The default remains available.</p>}
      </div>
      <ExampleResult label="Resolved setting">
        <output>
          {setting.value ? "Enabled" : "Disabled"} — {setting.source}. Evaluation: {snapshot.status}.
        </output>
      </ExampleResult>
    </section>
  )
}
