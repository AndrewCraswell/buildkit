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
import { useState } from "react"
import { useFluentDemoStyles } from "./FluentDemo.styles.js"

export function FluentDemo(options: FluentThemeOptions) {
  const [store] = useState(() => createFluentTheme(options))
  const { theme, resolvedTheme, setTheme } = useTheme(store)
  const classes = useFluentDemoStyles()
  return (
    <FluentThemeProvider store={store} className={classes.surface}>
      <section className={classes.content} aria-label="Fluent theme example">
        <Text as="h1" size={600} weight="semibold">
          Fluent UI appearance
        </Text>
        <p>Follow your device or choose a theme.</p>
        <fieldset className={classes.actions} aria-label="Appearance">
          {(["system", "light", "dark"] as const).map((value) => (
            <Button
              key={value}
              aria-pressed={theme === value}
              appearance={theme === value ? "primary" : "secondary"}
              onClick={() => setTheme(value)}
            >
              {value}
            </Button>
          ))}
          <Button onClick={() => store.reset()}>Reset theme</Button>
        </fieldset>
        <output>
          Preference: {theme}. Displaying: {resolvedTheme}.
        </output>
        <Dialog>
          <DialogTrigger disableButtonEnhancement>
            <Button>Open Fluent dialog</Button>
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
      </section>
    </FluentThemeProvider>
  )
}
