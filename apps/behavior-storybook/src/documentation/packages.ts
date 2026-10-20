export const packages = [
  {
    name: "dev-domains",
    group: "Tooling",
    summary: "Stable local HTTPS domains for applications, Storybook, and Git worktrees, built on Portless.",
    code: "npm install --save-dev @buildkitgg/dev-domains\n\nnpx @buildkitgg/dev-domains detect\nnpx @buildkitgg/dev-domains urls\nnpx @buildkitgg/dev-domains setup\nnpx @buildkitgg/dev-domains run",
    api: [
      "defineConfig(config): author validated, typed endpoint configuration.",
      "getEndpoint(service, cwd?): resolve an endpoint from Node tooling without starting a server.",
      "playwrightServer(service, cwd?): connect Playwright to a dedicated E2E endpoint.",
      "CLI: detect, urls, init, setup, run, status, doctor, tunnel, and schema."
    ],
    notes:
      "This is a Node.js development tool. The examples explain terminal workflows; they do not start proxies, trust certificates, or run commands in the browser. Portless handles local routing and HTTPS. Application data and cloud resources remain under your control.",
    example: "tooling-dev-domains--setup"
  },
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
    example: "react-react-preferences--defaults-and-reset"
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
    example: "fluent-ui-fluentui-theme--system"
  },
  {
    name: "react-preferences",
    group: "React",
    summary: "Typed React subscriptions to an application-owned preferences store.",
    code: 'import { usePreference } from "@buildkitgg/react-preferences"\nimport { preferences } from "./preferences"\n\nfunction PageSize() {\n  const [size, setSize] = usePreference(preferences, "pageSize")\n  return <button onClick={() => setSize(50)}>{size}</button>\n}',
    api: ["usePreference(store, key): typed value and setter.", "usePreferences(store): the whole effective snapshot."],
    notes:
      "React 19 is a peer dependency. No provider is required. Hooks use useSyncExternalStore; per-key hooks currently subscribe to the whole store.",
    example: "react-react-preferences--defaults-and-reset"
  },
  {
    name: "react-theme",
    group: "React",
    summary: "Provider-free React bindings for Buildkit theme stores.",
    code: 'import { useTheme } from "@buildkitgg/react-theme"\nimport { theme } from "./theme"\n\nfunction Appearance() {\n  const { theme: selected, resolvedTheme, setTheme, reset } = useTheme(theme)\n  return <button onClick={reset}>Reset {selected} theme</button>\n}',
    api: ["useTheme(store): returns theme, resolvedTheme, setTheme and reset."],
    notes:
      "React 19 is a peer dependency. The hook subscribes but does not start browser effects. Use the adapter lifecycle. Fluent UI still needs its native styling provider.",
    example: "shadcn-shadcn-theme--appearance"
  },
  {
    name: "shadcn-theme",
    group: "shadcn",
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
    example: "shadcn-shadcn-theme--appearance"
  },
  {
    name: "fluentui-theme",
    group: "Fluent UI",
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
    example: "fluent-ui-fluentui-theme--system"
  },
  {
    name: "shadcn-baseui-kit",
    group: "shadcn",
    summary: "Compiled shadcn Base UI components and CSS, exported from one package.",
    code: 'pnpm add @buildkitgg/shadcn-baseui-kit\n\n// In your application:\nimport { Button } from "@buildkitgg/shadcn-baseui-kit"\nimport "@buildkitgg/shadcn-baseui-kit/styles.css"\n\n<Button>Save changes</Button>',
    api: [
      "Root exports: import components directly from the package.",
      "styles.css: compiled styles with reset; import once.",
      "styles-no-reset.css: use when the app owns its reset."
    ],
    notes:
      "React and React DOM are peer dependencies. No registry connection is required. Override CSS theme variables after the stylesheet. The theme adapter is optional. Components below reuse the package's maintained examples.",
    example: "shadcn-shadcn-baseui-kit-actions--button"
  },
  {
    name: "modal-core",
    group: "Core",
    summary: "Framework-independent modal stacks, typed results, updates, and cleanup.",
    code: 'import { createModalStore } from "@buildkitgg/modal-core"\n\nconst modals = createModalStore<string>()\nconst handle = modals.open({\n  defaultResult: false,\n  createContent: () => "Delete draft?"\n})\nhandle.close(true)\nconst confirmed = await handle\n// A renderer calls entry.finishExit() after its exit animation.',
    api: [
      "createModalStore<TContent>(): isolated observable stack.",
      "open(): awaitable handle with close, dismiss, update and isActive.",
      "closeAll(): dismiss the stack, preserving entries for exit.",
      "clear / dispose: settle pending results and remove entries."
    ],
    notes:
      "Core does not import React, access the DOM, or schedule animation timers. Closing a parent dismisses its descendants. IDs remain reserved until exit completes. Results are set once. Snapshots are immutable; content is opaque. Server snapshots are empty.",
    example: "core-modal-core--lifecycle"
  },
  {
    name: "react-modals",
    group: "React",
    summary: "React subscriptions, typed modal definitions, and shared confirm/alert helpers.",
    code: 'import { createModalManager, ModalRenderer } from "@buildkitgg/react-modals"\n\nexport const modals = createModalManager({\n  adapter: { Surface: YourSurface }\n})\n// Mount once: <ModalRenderer manager={modals} />\nconst confirmed = await modals.confirm({ title: "Delete draft?" })\n// Use a UI package for a built-in adapter.',
    api: [
      "createModalManager({ labels?, adapter? }): open, alert, confirm and createModal.",
      "createModal({ initialState, render, defaultResult }): inferred state, opening overrides and typed results.",
      "controls.update / submit: typed state changes and async completion with retryable errors.",
      "beforeDismiss(data): optional guard for unsaved changes.",
      "useModals(manager): reactive snapshot without a context provider.",
      "ModalRenderer: one host, nested rendering and unmount cleanup."
    ],
    notes:
      "Mount one renderer per manager. Calls can originate outside React. Components receive data, controls, isPending and error. Results default to state plus null; typed components or generics can specify another result. Explicit close and host teardown bypass guards. The host clears on unmount and tolerates StrictMode reconnects. A custom surface owns accessibility and calls finishExit.",
    example: "react-react-modals--native-dialog"
  },
  {
    name: "shadcn-modals-manager",
    group: "shadcn",
    summary: "Managed shadcn dialogs with a default renderer and optional Base UI or Radix registry components.",
    code: 'import { createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"\nimport "@buildkitgg/shadcn-modals-manager/styles.css"\n\nexport const modals = createModalManager()\n\n<ModalRenderer manager={modals} />\n\nawait modals.alert({ title: "Changes saved" })',
    api: [
      "createModalManager({ labels?, adapter? }): the same typed contract as the Fluent manager.",
      "ModalRenderer: renders the manager's adapter; requires only manager.",
      "adapter: baseUiComponents(...) or radixComponents(...) binds your registry components once.",
      "surfaceProps: portable className and style options."
    ],
    notes:
      "The default adapter includes the Base UI component kit. Import styles.css once, or use your existing kit stylesheet. For registry components, pass an adapter to createModalManager using the matching helper. The standard ModalRenderer stays the same. Each manager retains its own adapter, which overrides the package default. React and React DOM are peers. Styles, UI providers and custom form controls remain application setup.",
    example: "shadcn-shadcn-modals-manager--confirmation"
  },
  {
    name: "fluentui-modals-manager",
    group: "Fluent UI",
    summary: "Managed Fluent UI dialogs with typed inputs and results.",
    code: 'import { createModalManager, ModalRenderer } from "@buildkitgg/fluentui-modals-manager"\n\nexport const modals = createModalManager()\n// Mount inside your existing FluentProvider:\n<ModalRenderer manager={modals} />\n\nconst confirmed = await modals.confirm({\n  title: "Delete draft?",\n  confirmLabel: "Delete",\n  cancelLabel: "Keep draft"\n})',
    api: [
      "createModalManager({ labels?, adapter? }): the same typed contract as the shadcn manager.",
      "ModalRenderer: renders the manager's adapter; Fluent dialogs and motion by default.",
      "labels: application defaults for confirm, cancel and close buttons."
    ],
    notes:
      "React, React DOM and Fluent UI v9 are peer dependencies. Mount the renderer inside your FluentProvider for theme and portal support. Modal state, results, updates and confirmation semantics are shared with the shadcn adapter.",
    example: "fluent-ui-fluentui-modals-manager--confirmation"
  },
  {
    name: "alert-core",
    group: "Core",
    summary: "Framework-independent, persistent inline alert regions.",
    code: 'import { createAlertStore } from "@buildkitgg/alert-core"\n\nconst alerts = createAlertStore<{ message: string }>()\nconst notice = alerts.add({ body: { message: "Sync paused" } }, "account")\nnotice.update({ body: { message: "Sync complete" }, intent: "success" })\nnotice.dismiss()',
    api: [
      "add / info / success / warning / error: return a region-bound handle.",
      "handle.update / handle.dismiss / handle.isActive: control that exact alert instance.",
      "getSnapshot / subscribe: stable snapshots and region-scoped notifications.",
      "dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.",
      "dispose(): clear silently, notify subscribers, and reject future additions."
    ],
    notes:
      "Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking dismissal; old handles become inactive. Mount once per region. Payload objects remain caller-owned; replace them through updates instead of mutating them.",
    example: "core-alert-core--typed-payload"
  },
  {
    name: "react-alerts",
    group: "React",
    summary: "Persistent inline alerts with external commands and shared lifecycle behavior.",
    code: 'import { createAlertManager, AlertRegion } from "@buildkitgg/react-alerts"\n\nexport const alerts = createAlertManager({ adapter: { Alert: YourAlert } })\n<AlertRegion manager={alerts} />\n\nalerts.warning({ id: "billing", title: "Update your payment method" })',
    api: [
      "add / info / success / warning / error: return a region-bound handle.",
      "handle.update / handle.dismiss / handle.isActive: control that exact alert instance.",
      "getSnapshot / subscribe: stable snapshots and region-scoped notifications.",
      "dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.",
      "dispose(): clear silently, notify subscribers, and reject future additions."
    ],
    notes:
      "Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking dismissal; old handles become inactive. Mount once per region. ReactNode content and optional adapters are React-specific; the store has no browser effects.",
    example: "react-react-alerts--custom-renderer"
  },
  {
    name: "shadcn-alerts-manager",
    group: "shadcn",
    summary: "Persistent inline alerts with external commands and shared lifecycle behavior.",
    code: 'import { createAlertManager, AlertRegion } from "@buildkitgg/shadcn-alerts-manager"\n\nexport const alerts = createAlertManager()\n<AlertRegion manager={alerts} />\n\nalerts.warning({ id: "billing", title: "Update your payment method" })',
    api: [
      "add / info / success / warning / error: return a region-bound handle.",
      "handle.update / handle.dismiss / handle.isActive: control that exact alert instance.",
      "getSnapshot / subscribe: stable snapshots and region-scoped notifications.",
      "dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.",
      "dispose(): clear silently, notify subscribers, and reject future additions."
    ],
    notes:
      "Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking dismissal; old handles become inactive. Mount once per region. Import styles.css once for the default kit. For registry components, pass adapter: alertComponents({ Alert, AlertTitle, AlertDescription, Button }); no Base UI/Radix switch is needed.",
    example: "shadcn-shadcn-alerts-manager--dismissal"
  },
  {
    name: "fluentui-alerts-manager",
    group: "Fluent UI",
    summary: "Persistent inline alerts with external commands and shared lifecycle behavior.",
    code: 'import { createAlertManager, AlertRegion } from "@buildkitgg/fluentui-alerts-manager"\n\nexport const alerts = createAlertManager()\n<AlertRegion manager={alerts} />\n\nalerts.warning({ id: "billing", title: "Update your payment method" })',
    api: [
      "add / info / success / warning / error: return a region-bound handle.",
      "handle.update / handle.dismiss / handle.isActive: control that exact alert instance.",
      "getSnapshot / subscribe: stable snapshots and region-scoped notifications.",
      "dismissAll(region): remove alerts and invoke callbacks; flush(): clear all regions silently.",
      "dispose(): clear silently, notify subscribers, and reject future additions."
    ],
    notes:
      "Alerts are persistent. Use the native toast manager for timed feedback. Reusing an ID replaces in place without invoking dismissal; old handles become inactive. Mount once per region. Supply FluentProvider and the React/Fluent peer dependencies.",
    example: "fluent-ui-fluentui-alerts-manager--dismissal"
  },
  {
    name: "router-core",
    group: "Core",
    summary: "Framework-independent tab selection and panel navigation policies.",
    code: 'const tabs = createRouteTabs({ tabs: [{ id: "people", route: peopleRoute }] })\ntabs.activeTab\nawait tabs.select("people")\n\nconst panel = createRoutePanel({ route: personRoute, closeTo: peopleRoute })\nawait panel.close()',
    api: [
      "createRouteTabs({ tabs, defaultTab? }): infer tab IDs; first match wins.",
      "createRoutePanel({ route, closeTo, exclude? }): derive isOpen; open, close, setOpen.",
      "RouteTarget: href, isActive(), navigate()."
    ],
    notes:
      "Core has no React or router dependency. Route targets delegate matching and navigation. defaultTab is a display fallback, not a redirect. closeTo makes direct-link dismissal safe.",
    example: "routing-react-router--route-tabs"
  },
  {
    name: "react-routing",
    group: "React",
    summary: "Provider-free React bindings for route tabs and panels.",
    code: 'const tabs = useRouteTabs(adapter, {\n  tabs: [{ id: "people", route: peopleRoute }]\n})\nconst panel = useRoutePanel(adapter, { route: personRoute, closeTo: peopleRoute })\n// Bind tabs.activeTab / tabs.select to your tabs.\n// Bind panel.isOpen / panel.setOpen to your drawer.',
    api: [
      "useRouteTabs(adapter, options): subscribe and derive activeTab/select.",
      "useRoutePanel(adapter, options): subscribe and derive isOpen/open/close/setOpen.",
      "RouterAdapter: subscribe, getSnapshot, getServerSnapshot."
    ],
    notes:
      "Uses useSyncExternalStore and cleans up subscriptions. No local copy of URL state. Applications provide their own tabs and panel components. Create adapters per router and per SSR request.",
    example: "routing-react-router--route-tabs"
  },
  {
    name: "react-router",
    group: "React",
    summary: "Route tabs and panels for React Router data routers.",
    code: 'import { createRouterAdapter, useRoutePanel } from "@buildkitgg/react-router"\n\nconst adapter = createRouterAdapter(router)\nconst person = adapter.route({ to: "/people/42", match: "/people/:id" })\nconst people = adapter.route({ to: "/people", preserveSearch: true })\n\nfunction PersonPanel() {\n  const panel = useRoutePanel(adapter, { route: person, closeTo: people })\n  return <YourPanel open={panel.isOpen} onOpenChange={panel.setOpen} />\n}',
    api: [
      "createRouterAdapter(router): connect a data router without another provider.",
      "adapter.route({ to, match?, navigate?, preserveSearch? }): create a route target.",
      "useRouteTabs / useRoutePanel: shared React behavior."
    ],
    notes:
      "Use createBrowserRouter or createMemoryRouter. Rooted destinations and concrete params are required for navigation. Native matchPath handles route patterns. Query preservation is opt-in. Use native Link for normal link behavior.",
    example: "routing-react-router--route-tabs"
  },
  {
    name: "tanstack-router",
    group: "React",
    summary: "Typed route tabs and panels for TanStack Router.",
    code: 'import { createRouterAdapter, useRoutePanel } from "@buildkitgg/tanstack-router"\n\nconst adapter = createRouterAdapter(router)\nconst person = adapter.route({\n  to: "/people/$id", params: { id: "42" }, search: true\n})\nconst people = adapter.route({ to: "/people", search: true })\n\nfunction PersonPanel() {\n  const panel = useRoutePanel(adapter, { route: person, closeTo: people })\n  return <YourPanel open={panel.isOpen} onOpenChange={panel.setOpen} />\n}',
    api: [
      "createRouterAdapter(router): infer the supplied route tree.",
      "adapter.route(navigation, match?): validate destinations and required params.",
      "useRouteTabs / useRoutePanel: shared React behavior."
    ],
    notes:
      "Native navigation options preserve search, hashes, replace behavior and typed params. Use fuzzy: true in match options for parent tabs. Native Link owns link behavior. State follows completed navigation.",
    example: "routing-tanstack-router--route-tabs"
  }
] as const

/** Shared navigation for package directories and the public site. */
export function packageOverviewId(entry: { name: string; group: string }) {
  const routing: Record<string, string> = {
    "router-core": "routing-core",
    "react-routing": "routing-react-bindings",
    "react-router": "routing-react-router",
    "tanstack-router": "routing-tanstack-router"
  }
  return `${routing[entry.name] ?? `${entry.group.toLowerCase().replaceAll(" ", "-")}-${entry.name}`}--overview`
}
