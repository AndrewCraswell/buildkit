import { useTheme } from "@buildkitgg/react-theme"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@buildkitgg/shadcn-baseui-kit"
import { useEffect } from "react"
import { theme, resetTheme } from "./theme.js"
import "@buildkitgg/shadcn-baseui-kit/styles.css"
import "./styles.css"

export function ShadcnDemo() {
  useEffect(() => theme.start(), [])
  const { theme: selection, resolvedTheme, setTheme } = useTheme(theme)
  return (
    <main className="shadcn-demo">
      <header>
        <p className="eyebrow">BUILDKIT</p>
        <h1>Your app. Your theme.</h1>
        <p>One preference, shared across your application.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Follow your device or choose a theme. Your choice is saved on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="choices" aria-label="Theme preference">
            {(["system", "light", "dark"] as const).map((value) => (
              <Button
                key={value}
                aria-pressed={selection === value}
                variant={selection === value ? "default" : "outline"}
                onClick={() => setTheme(value)}
              >
                {{ system: "System", light: "Light", dark: "Dark" }[value]}
              </Button>
            ))}
          </fieldset>
          <output>
            Preference: {selection}. Displaying: {resolvedTheme}.
          </output>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Works across your app</CardTitle>
          <CardDescription>Dialogs inherit the same theme, without a theme provider.</CardDescription>
        </CardHeader>
        <CardContent className="actions">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>A consistent appearance</DialogTitle>
                <DialogDescription>This dialog inherits the theme applied to the document.</DialogDescription>
              </DialogHeader>
              <p>Current theme: {resolvedTheme}</p>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={resetTheme}>
            Reset to system
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
