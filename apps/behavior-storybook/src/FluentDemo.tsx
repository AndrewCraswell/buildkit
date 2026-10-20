import { createFluentTheme, FluentThemeProvider, useTheme, type FluentThemeOptions } from "@buildkitgg/fluentui-theme"
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Text
} from "@fluentui/react-components"
import { ExampleResult } from "@repo/storybook-config/examples"
import { useState } from "react"
import { useFluentDemoStyles } from "./FluentDemo.styles.js"

export function FluentDemo({ showPortal = false, ...options }: FluentThemeOptions & { showPortal?: boolean }) {
  const [store] = useState(() => createFluentTheme(options))
  const { theme, resolvedTheme, setTheme } = useTheme(store)
  const classes = useFluentDemoStyles()
  return (
    <FluentThemeProvider store={store} className={classes.surface}>
      <section className={classes.content} aria-label="Fluent theme example">
        <div>
          <Text as="h2" size={400} weight="semibold">
            Appearance
          </Text>
          <p className="bk-item-description">Choose a theme for your workspace.</p>
        </div>
        <fieldset className={classes.actions} aria-label="Appearance">
          {(["system", "light", "dark"] as const).map((value) => (
            <Button
              key={value}
              aria-pressed={theme === value}
              appearance={theme === value ? "primary" : "secondary"}
              onClick={() => setTheme(value)}
            >
              {{ system: "System", light: "Light", dark: "Dark" }[value]}
            </Button>
          ))}
          <Button onClick={() => store.reset()}>Reset theme</Button>
        </fieldset>
        <ExampleResult label="Resolved theme">{resolvedTheme}</ExampleResult>
        {showPortal && (
          <Dialog>
            <DialogTrigger disableButtonEnhancement>
              <Button>Preview dialog</Button>
            </DialogTrigger>
            <DialogSurface>
              <DialogBody>
                <DialogTitle>Themed dialog</DialogTitle>
                <DialogContent>This portaled dialog uses the {resolvedTheme} theme.</DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement>
                    <Button>Close</Button>
                  </DialogTrigger>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
        )}
      </section>
    </FluentThemeProvider>
  )
}
