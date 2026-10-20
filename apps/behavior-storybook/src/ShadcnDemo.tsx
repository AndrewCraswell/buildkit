import { useTheme } from "@buildkitgg/react-theme"
import {
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@buildkitgg/shadcn-baseui-kit"
import { createShadcnTheme, type ShadcnThemeOptions } from "@buildkitgg/shadcn-theme"
import { ExampleResult } from "@repo/storybook-config/examples"
import { useEffect, useState } from "react"
export type ShadcnDemoProps = ShadcnThemeOptions & { showPortal?: boolean }
export function ShadcnDemo({ showPortal = false, ...options }: ShadcnDemoProps) {
  const [store] = useState(() => createShadcnTheme(options))
  useEffect(() => store.start(), [store])
  const { theme: selection, resolvedTheme, setTheme } = useTheme(store)
  return (
    <section>
      <div className="bk-settings">
        <div>
          <p className="bk-item-title">Appearance</p>
          <p className="bk-item-description">Choose a theme for your workspace.</p>
        </div>
        <fieldset className="bk-theme-options" aria-label="Theme preference">
          {(["light", "dark", "system"] as const).map((value) => (
            <button
              className="bk-theme-choice"
              key={value}
              aria-pressed={selection === value}
              onClick={() => setTheme(value)}
            >
              <span className="bk-theme-swatch" data-mode={value} aria-hidden="true">
                <i />
                <span />
              </span>
              <span>{{ light: "Light", dark: "Dark", system: "System" }[value]}</span>
            </button>
          ))}
        </fieldset>
        <div className="actions">
          <Button variant="outline" onClick={() => store.reset()}>
            Reset theme
          </Button>
          {showPortal && (
            <Dialog>
              <DialogTrigger render={<Button />}>Preview dialog</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Workspace appearance</DialogTitle>
                  <DialogDescription>
                    This dialog inherits the {resolvedTheme} theme, including when rendered in a portal.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <ExampleResult label="Resolved theme">{resolvedTheme}</ExampleResult>
    </section>
  )
}
