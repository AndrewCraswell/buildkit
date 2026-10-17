export const packages = [
  {
    name: "preferences-core",
    group: "Core",
    summary: "Typed defaults, overrides, persistence, and JSON backup without a framework dependency.",
    code: 'import { createPreferences } from "@buildkitgg/preferences-core"\n\ntype Preferences = { pageSize: number; name: string }\nconst preferences = createPreferences<Preferences>({\n  defaults: { pageSize: 25 },\n  storage: "localStorage",\n  key: "my-app-preferences"\n})\npreferences.set("pageSize", 50)\npreferences.get("name") // string | undefined\npreferences.reset("pageSize")',
    api: [
      "createPreferences(options): infer types from defaults or supply a generic.",
      "get / set / reset / resetAll: read values, set overrides, restore defaults.",
      "subscribe / getSnapshot: observe immutable snapshots.",
      "exportJson / importJson: export overrides; merge or replace atomically.",
      "dispose: disconnect factory-owned persistence and listeners."
    ],
    notes:
      "localStorage synchronizes same-origin tabs. sessionStorage is tab-specific. A key is required when storage is enabled. JSON receives basic checks against defaults; TypeScript unions and unknown keys are not runtime schemas.",
    example: "react-react-preferences--playground"
  },
  {
    name: "theme-core",
    group: "Core",
    summary: "System, light, and dark selection with an explicit application default.",
    code: 'import { createThemeStore } from "@buildkitgg/theme-core"\nimport { connectBrowserTheme } from "@buildkitgg/theme-core/browser"\n\nconst theme = createThemeStore({ defaultTheme: "system" })\nconst stop = connectBrowserTheme(theme, { storageKey: "my-app-theme" })\ntheme.setTheme("dark")\ntheme.reset() // Restore the app default.\nstop() // Disconnect browser effects.',
    api: [
      "createThemeStore(options): create isolated theme state.",
      "setTheme / reset: select a theme or remove the override.",
      "getSnapshot / subscribe: observe selection and resolved appearance.",
      "connectBrowserTheme: optional device and storage integration."
    ],
    notes:
      "Core does not apply styling. Persistence is internal. Use a UI adapter for rendering. Create stores per server request; systemTheme supplies the initial server resolution.",
    example: "themes-fluentui-theme--system"
  },
  {
    name: "react-preferences",
    group: "React",
    summary: "Typed React subscriptions to an application-owned preferences store.",
    code: 'import { usePreference } from "@buildkitgg/react-preferences"\nimport { preferences } from "./preferences"\n\nfunction PageSize() {\n  const [size, setSize] = usePreference(preferences, "pageSize")\n  return <button onClick={() => setSize(50)}>{size}</button>\n}',
    api: ["usePreference(store, key): typed value and setter.", "usePreferences(store): the whole effective snapshot."],
    notes:
      "React 19 is a peer dependency. No provider is required. Hooks use useSyncExternalStore; per-key hooks currently subscribe to the whole store.",
    example: "react-react-preferences--playground"
  },
  {
    name: "react-theme",
    group: "React",
    summary: "Provider-free React bindings for Buildkit theme stores.",
    code: 'import { useTheme } from "@buildkitgg/react-theme"\nimport { theme } from "./theme"\n\nfunction Appearance() {\n  const { theme: selected, resolvedTheme, setTheme, reset } = useTheme(theme)\n  return <button onClick={reset}>Reset {selected} theme</button>\n}',
    api: ["useTheme(store): returns theme, resolvedTheme, setTheme and reset."],
    notes:
      "React 19 is a peer dependency. The hook subscribes but does not start browser effects. Use the adapter lifecycle. Fluent UI still needs its native styling provider.",
    example: "themes-shadcn-theme--appearance"
  },
  {
    name: "shadcn-theme",
    group: "Themes",
    summary: "Theme selection for registry-installed shadcn components or the Buildkit component kit.",
    code: 'import { createShadcnTheme } from "@buildkitgg/shadcn-theme"\n\nexport const theme = createShadcnTheme({\n  defaultTheme: "system",\n  storageKey: "my-app-theme"\n})\nconst stop = theme.start() // At browser startup.\ntheme.setTheme("dark")\ntheme.reset()\n// Call stop() at teardown.',
    api: [
      "createShadcnTheme(options): isolated theme with optional persistence.",
      "start(): apply .dark and color-scheme; returns cleanup.",
      "setTheme / reset: choose appearance or restore the default.",
      "getThemeInitScript(options): first-paint script; use matching options and a CSP nonce."
    ],
    notes:
      "No dependency on React or our component kit. Supply your own CSS and tokens using the .dark convention. Use one instance per document. Construction has no browser effects.",
    example: "themes-shadcn-theme--appearance"
  },
  {
    name: "fluentui-theme",
    group: "Themes",
    summary: "Fluent UI v9 themes with external state, custom tokens, and native portal support.",
    code: 'import { createFluentTheme, FluentThemeProvider } from "@buildkitgg/fluentui-theme"\n\nexport const theme = createFluentTheme({\n  defaultTheme: "system", // Or "dark" for a dark-first app.\n  storageKey: "my-app-theme",\n  storage: "localStorage"\n})\n\nexport function App() {\n  return <FluentThemeProvider store={theme}><YourApp /></FluentThemeProvider>\n}\n\ntheme.setTheme("dark") // Works outside React too.\ntheme.reset() // Restore the app default.',
    api: [
      "createFluentTheme(options): accepts complete lightTheme and darkTheme token objects.",
      "FluentThemeProvider: native Fluent context with automatic connection cleanup.",
      "useTheme(store): theme, resolvedTheme, setTheme and reset.",
      "start(): optional manual lifecycle outside React."
    ],
    notes:
      "Fluent UI v9, React 19 and React DOM 19 are peers supplied by the app. The provider supplies styling; selection is external. Use Fluent's createLightTheme/createDarkTheme or extend its web themes for custom tokens. Browser preferences restore after mount, so SSR must account for possible appearance changes.",
    example: "themes-fluentui-theme--system"
  },
  {
    name: "shadcn-baseui-kit",
    group: "Components",
    summary: "Compiled shadcn Base UI components and CSS, exported from one package.",
    code: 'pnpm add @buildkitgg/shadcn-baseui-kit\n\n// In your application:\nimport { Button } from "@buildkitgg/shadcn-baseui-kit"\nimport "@buildkitgg/shadcn-baseui-kit/styles.css"\n\n<Button>Save changes</Button>',
    api: [
      "Root exports: import components directly from the package.",
      "styles.css: compiled styles with reset; import once.",
      "styles-no-reset.css: use when the app owns its reset."
    ],
    notes:
      "React and React DOM are peer dependencies. No registry connection is required. Override CSS theme variables after the stylesheet. The theme adapter is optional. Components below reuse the package's maintained examples.",
    example: "components-shadcn-baseui-kit-actions--button"
  }
] as const
