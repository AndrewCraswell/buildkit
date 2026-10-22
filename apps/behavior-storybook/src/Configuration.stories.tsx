import type { Meta, StoryObj } from "@storybook/react-vite"
import { ConfigurationDemo } from "./ConfigurationDemo.js"
const meta = {
  title: "React/react-configuration",
  component: ConfigurationDemo,
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof ConfigurationDemo>
export default meta
type Story = StoryObj<typeof meta>
export const ConfigurationAndPreferences: Story = {
  name: "Configuration and preferences",
  args: { scenario: "language" },
  parameters: {
    docs: {
      description: {
        story:
          "The provider chooses an app default. The user chooses a preference. Resetting the preference restores the configured default."
      },
      source: {
        code: 'const { value: defaultLanguage } = config.useSetting("defaultLanguage")\nconst [language, setLanguage] = usePreference(preferences, "language")\nconst effectiveLanguage = language ?? defaultLanguage\n\n// Reset the user choice; configuration stays unchanged.\npreferences.reset("language")'
      }
    }
  }
}
export const DefaultsAndLoading: Story = {
  args: { scenario: "loading" },
  parameters: {
    docs: {
      description: { story: "Defaults are available before evaluation. Load the provider to enable the new checkout." },
      source: { code: 'const { value, source } = config.useSetting("newCheckout")\nawait config.refresh()' }
    }
  }
}
export const TargetingContext: Story = {
  args: { scenario: "targeting" },
  parameters: {
    docs: {
      description: {
        story:
          "Switch rollout cohorts. Previous provider values clear immediately, and late responses cannot replace the active cohort’s evaluation."
      },
      source: {
        code: 'await config.setContext({ cohort: "standard" })\nawait config.setContext({ cohort: "early-access" })'
      }
    }
  }
}
export const DeveloperOverrides: Story = {
  args: { scenario: "overrides" },
  parameters: {
    docs: {
      description: {
        story:
          "Force a value locally, then reset it to the provider result. Overrides are opt-in and independent of provider evaluation."
      },
      source: { code: 'config.override("newCheckout", false)\nconfig.reset("newCheckout")' }
    }
  }
}
export const FailureAndRetry: Story = {
  args: { scenario: "failure" },
  parameters: {
    docs: {
      description: {
        story:
          "The first evaluation fails. Retry to recover; safe defaults remain usable while the provider is unavailable."
      },
      source: { code: "const { status, error } = config.useConfiguration()\nawait config.refresh()" }
    }
  }
}
