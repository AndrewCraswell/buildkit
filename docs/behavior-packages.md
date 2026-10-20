# Shared application behavior

Buildkit extracts reusable behavior into framework-independent stores, adds React bindings where needed, and keeps
UI-library rendering in adapters. Factories replace process-wide mutable singletons; apps may export their own shared
instance. Core contracts must not import ReactNode, Fluent props, browser globals, or a particular router.

## Theme implementation

- `@buildkitgg/preferences-core`: generic defaults and overrides, immutable snapshots, JSON import/export, optional
  local/session storage and disposal. Browser persistence is also available through an explicit `/browser` connection.
- `@buildkitgg/react-preferences`: provider-free whole-store and typed per-key hooks.

- `@buildkitgg/theme-core`: uses preferences-core for overrides, then adds system resolution and theme validation.
  Optional `/browser` connects device settings and local storage without applying a UI theme.

Theme storage uses the same JSON override object (`{"theme":"dark"}`) as preferences. Invalid theme strings fall back to
the app default when resolving appearance. No general preferences API can infer enum constraints from types.

- `@buildkitgg/react-theme`: `useTheme(store)` via `useSyncExternalStore`, with no context provider.
- `@buildkitgg/shadcn-theme`: document classes, color-scheme, connection lifecycle and first-paint script.
- `@buildkitgg/fluentui-theme`: Fluent theme tokens, native provider integration, and shared browser connection
  lifecycle.
- `apps/behavior-storybook`: shadcn, Fluent UI, and preferences examples with persistence and portaled UI.

System is the default. Apps can override the default; a valid persisted user choice takes precedence. Browser effects
are explicit and disposable. TypeScript declarations accompany each package's compiled exports.

## Existing Fluent implementations: extraction plan

Review of the four local repositories in `D:/msft` informed these boundaries. The original repositories remain
unchanged. Modal, alert, and routing packages are implemented in Buildkit; form package names remain provisional.

| Existing implementation                                                                                     | Extractable behavior                                                                                                                                              | Keep in adapters                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fluentui-modal-manager/src/ModalManager.tsx` and `ModalManager.types.ts`                                   | `modal-core`: stack snapshots, handles, duplicate-ID policy, updates, settlement, and open/closing lifecycle                                                      | React render callbacks and ReactNode content; Fluent DialogModalType and surface props; built-in confirm/alert bodies and animation completion                       |
| `fluentui-message-bar-manager/src/MessageBarManager.ts`                                                     | `alert-core`: region queues, IDs, replacement, handles, update/dismiss/flush semantics and notifications                                                          | ReactNode title/body/action labels and Fluent surfaces; shadcn Alert composition and dismissal controls                                                              |
| `fluentui-rhf-inputs/src/utils/getControlledComponentProps.ts` and controlled inputs                        | Form-library adapters for typed values, field state, validation, blur/ref/handler composition; extract only genuinely independent value transformations into core | RHF Controller, FieldPath and rules stay RHF-specific; Fluent FieldProps and `(event, data)` mapping stay Fluent-specific; shadcn controls get their own UI mappings |
| `fluentui-react-router/src/hooks/useRoutePanel.ts`, `useTabRoutes.ts`, and `prefetch/routePrefetchStore.ts` | Route destination/default policy and reusable prefetch caching where independent of router APIs                                                                   | React Router matching/navigation and route objects; Fluent event types and link shims; shadcn rendering and event signatures                                         |

## Migration order and acceptance

1. Modal lifecycles are implemented in `modal-core`, `react-modals`, `shadcn-modals-manager`, and
   `fluentui-modals-manager`. See [architecture and lifecycle](modals.md) for extraction decisions and the adapter
   contract.
2. Alert packages use generic content, region-scoped subscriptions, immutable snapshots, replacement, and distinct
   dismiss/flush semantics. See [alert architecture](alerts.md); timed feedback uses native toast APIs.
3. Router tabs and panels are implemented in router-core, react-routing, react-router, and tanstack-router. See
   [routing](routing.md). They derive tab and panel state from the URL, rather than retaining a second selection state.
   Preserve query-string policy, route exclusions, modified-click semantics, and direct-link dismissal destinations.
   Keep React Router's matching semantics in its adapter rather than reimplementing its route parser.
4. Split form bindings by field family. Preserve generics, refs, validation precedence, handler composition, and value
   shapes for text, checked values, arrays, dates and time. Add TanStack Form bindings separately; do not treat RHF's
   Controller contract as framework-agnostic core.
5. Add Fluent and shadcn surfaces against the extracted contracts. Existing Fluent packages can delegate to those
   contracts after compatibility and publishing decisions are made. Reuse their existing behavioral tests to protect
   extraction semantics; do not duplicate upstream UI-library suites.

Native Fluent, Base UI, and Sonner toast managers already provide queues. No shared toast core is needed; see
[the research and package decision](alerts.md).

Avoid a universal behavior package or mandatory singleton. Split by domain and do not publish empty abstractions merely
to fill a package matrix. The Fluent theme adapter renders FluentProvider while selection remains in the core store.
