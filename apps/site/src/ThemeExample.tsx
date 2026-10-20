import { useTheme } from "@buildkitgg/react-theme"
import { createThemeStore } from "@buildkitgg/theme-core"
import { ArrowDown, Check, Code2, Moon, RotateCcw, Sun } from "lucide-react"
import { useState } from "react"
import { Button } from "./components/ui/Button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/Tabs"

export function ThemeExample() {
  const [store] = useState(() => createThemeStore({ defaultTheme: "dark" }))
  const { theme, setTheme, reset } = useTheme(store)
  return (
    <div className="theme-example" aria-label="Interactive Buildkit theme example">
      <div className="example-annotation">
        <span className="annotation-line" /> Try it: switch the theme
      </div>
      <div className={`appearance-preview ${theme === "dark" ? "dark" : ""}`}>
        <div className="preview-toolbar">
          <span className="preview-app-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>Workspace settings</span>
          <span className="live-label">Interactive example</span>
        </div>
        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <h3>Appearance</h3>
              <p className="preview-description">Choose a theme for this preview.</p>
            </div>
            <span className="appearance-icon">{theme === "dark" ? <Moon /> : <Sun />}</span>
          </div>
          <div className="appearance-setting">
            <div>
              <strong>Color theme</strong>
              <span>Reset restores the default.</span>
            </div>
            <fieldset className="appearance-buttons" aria-label="Example appearance">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Light appearance"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                <Sun />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dark appearance"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                <Moon />
              </Button>
            </fieldset>
          </div>
          <div className="preview-status">
            <span>
              <Check aria-hidden="true" />{" "}
              <span aria-live="polite">{theme === "dark" ? "Dark" : "Light"} theme selected</span>
            </span>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Reset
            </Button>
          </div>
        </div>
      </div>
      <div className="example-connector" aria-hidden="true">
        <span />
        <ArrowDown />
        <span />
      </div>
      <div className="code-card">
        <Tabs defaultValue="core">
          <div className="code-card-header">
            <Code2 aria-hidden="true" />
            <TabsList variant="line" aria-label="Theme code layer">
              <TabsTrigger value="core">Core</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
            </TabsList>
            <span>theme.ts</span>
          </div>
          <TabsContent value="core">
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll this code region. */}
            <pre tabIndex={0} aria-label="Core theme example">
              <code>
                <span className="syntax-purple">const</span> theme ={" "}
                <span className="syntax-blue">createThemeStore</span>
                {"({\n"}
                {"  "}defaultTheme: <span className="syntax-string">{'"dark"'}</span>
                {"\n"}
                {"})\n\n"}theme.<span className="syntax-blue">setTheme</span>(
                <span className="syntax-string">{`"${theme}"`}</span>){"\n"}
                <span className="syntax-comment">{"// One store. Use it anywhere."}</span>
              </code>
            </pre>
          </TabsContent>
          <TabsContent value="react">
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll this code region. */}
            <pre tabIndex={0} aria-label="React theme example">
              <code>
                <span className="syntax-purple">const</span> {"{ theme, setTheme, reset }"}
                {"\n"}
                {"  "}= <span className="syntax-blue">useTheme</span>(store){"\n\n"}
                <span className="syntax-comment">{"// Subscriptions handled for you."}</span>
                {"\n"}
                <span className="syntax-comment">{"// No provider component required."}</span>
              </code>
            </pre>
          </TabsContent>
        </Tabs>
        <div className="code-card-footer">
          <span className="file-dot" />
          {theme === "dark" ? 'theme: "dark"' : 'theme: "light"'}
          <span>TypeScript</span>
        </div>
      </div>
      <p className="example-caption">Powered by theme-core + react-theme.</p>
    </div>
  )
}
