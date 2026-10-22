# Public behavior APIs

These contracts separate reusable state from framework and UI integration. Package root exports include declarations;
browser-only connections have explicit entry points. Public APIs do not expose the internal preferences store used by
theme packages.

| Package           | Consumer API                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| preferences-core  | `createPreferences<T>`, `get`, `set`, `reset`, `resetAll`, snapshots, subscriptions, JSON import/export, `dispose`             |
| react-preferences | `usePreferences(store)`, `usePreference(store, key)`                                                                           |
| theme-core        | `createThemeStore`, `setTheme`, `reset`, snapshots, subscriptions, `setSystemTheme` for environment adapters                   |
| react-theme       | `useTheme(store)` returning selection, resolved appearance, `setTheme`, and `reset`                                            |
| shadcn-theme      | `createShadcnTheme`, the theme store contract plus reference-counted `start`, and `getThemeInitScript`                         |
| fluentui-theme    | `createFluentTheme`, the theme store contract plus tokens and reference-counted `start`, `FluentThemeProvider`, and `useTheme` |

## Preferences

Infer key/value types from defaults or supply a generic for unions and keys without defaults. Defaults are partial;
reads can return undefined. Setters and reset accept only declared string keys. Reset removes an override rather than
recording a replacement. Values must be JSON-compatible; nested values are copied and frozen. Consumers replace values
through setters rather than mutating snapshots.

Storage is optional. Choosing localStorage or sessionStorage requires a nonempty key; a key without a storage mechanism
is rejected. Explicit browser connections return cleanup. Factory-owned connections are released by `dispose`.

JSON import is atomic and supports merge or replace. Exports contain overrides only. Generics are compile-time
contracts, not runtime schemas: imports check JSON compatibility and basic categories available from defaults, not
unions, unknown keys, or nested shapes. Import trusted configuration; domain adapters validate semantic values.

## Themes

Selection is `light | dark | system`; resolved appearance is `light | dark`. System is the default selection. Apps may
override `defaultTheme` and the initial `systemTheme`. Invalid initial themes and setter values throw. `reset()` clears
the persisted override and restores the configured default, including when the selected value already equals it.

Omit storageKey for memory-only selection. A storageKey enables localStorage by default; selecting sessionStorage also
requires a key. Browser effects belong to explicit connections or adapter `start()` calls. Fluent's provider manages
that connection automatically; it remains necessary for native Fluent styling and portals. UI dependencies are peers.

Create isolated stores per server request. Server snapshots retain the initial state; match initial server/client
configuration during hydration. Shadcn's first-paint script uses the same selection and storage options as its store.

Changes to released contracts require an appropriate Beachball change file and semantic version decision.

## Modals

See the [modal API and lifecycle guide](modals.md). `modal-core` owns stack state and results; `react-modals` adds typed
content, subscriptions and the renderer. `shadcn-modals-manager` and `fluentui-modals-manager` both export
`createModalManager`, `ModalRenderer`, `ModalManager`, `ModalRendererProps` and `ModalSurfaceOptions`. Shared operations
and types are identical across adapters, including `ModalManagerOptions` and `ModalAdapter`. Both renderers require only
`manager`. `createModalManager({ labels?, adapter? })` binds the adapter once, falling back to the package's native
components when omitted. An explicit adapter always wins. `surfaceProps` contains portable `className` and `style`
fields. Optional shadcn registry integration uses `adapter: baseUiComponents(...)` or `adapter: radixComponents(...)`;
there is no primitive prop or renderer factory. Application styles, UI providers and custom form controls remain
application concerns. The UI adapters do not expose their internal core store.

Custom definitions use `createModal({ initialState, body, defaultResult, beforeDismiss? })`. State is inferred from
defaults; `open(overrides?)` and object/function updates remain typed. Custom updates use
`{ data: partialState, title?, description?, dismissible?, surfaceProps? }`; functional updaters receive presentation
and `current.data`. Results default to state plus `null`, with separate result types supported by annotated components
or generics. Core owns pending actions, errors and guarded dismissal; components own fields and validation. See
[form examples](modal-forms.md).

`title`, `body` and `footer` accept React nodes or live component slots. `onClose` observes typed results and close
reasons. See [slots and updates](modal-updates.md) for clearing, naming and adapter contracts.
