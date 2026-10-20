# @buildkitgg/shadcn-modals-manager

Managed shadcn dialogs with a default renderer and optional Base UI or Radix registry components.

```sh
pnpm add @buildkitgg/shadcn-modals-manager react react-dom
```

```tsx
import { createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"
import "@buildkitgg/shadcn-modals-manager/styles.css"

export const modals = createModalManager()

export function App() {
  return <ModalRenderer manager={modals} />
}

const confirmed = await modals.confirm({ title: "Delete draft?" })
```

The default renderer uses `@buildkitgg/shadcn-baseui-kit`, which is included as a dependency. Import the stylesheet
once; it provides the kit's tokens and compiled utilities without a global reset. If your app already loads the kit's
styles, no second import is needed. Override the shadcn CSS variables to apply your theme. React and React DOM are
peers.

## Switching UI libraries

`@buildkitgg/fluentui-modals-manager` exports the same `createModalManager`, `ModalRenderer`, manager types and renderer
props. Standard modal code needs only a package import change. Both renderers take `manager`; neither requires a
primitive or components prop. `surfaceProps` supports the shared `className` and `style` fields. Your app's theme,
stylesheet, FluentProvider and UI-specific custom form controls remain part of its UI setup.

## Use your registry components

Pass an optional adapter when creating the manager. Choose the helper matching your components' underlying library; the
helper owns the native lifecycle integration. There is no runtime inspection of component names or DOM markers.

```tsx
import {
  createModalManager,
  ModalRenderer,
  radixComponents
} from "@buildkitgg/shadcn-modals-manager"
import { Button } from "@/components/ui/button"
import * as dialog from "@/components/ui/dialog"

export const modals = createModalManager({
  adapter: radixComponents({ ...dialog, Button })
})

// Same renderer props and modal calls:
<ModalRenderer manager={modals} />
```

For Base UI registry components, use `baseUiComponents` in place of `radixComponents`:

```tsx
export const modals = createModalManager({
  adapter: baseUiComponents({ ...dialog, Button })
})
```

Import `baseUiComponents` from this package and use your Base UI dialog module. Both helpers expect `Dialog`,
`DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter` and `Button`.

The adapter is fixed for that manager's lifetime. Omit it to use the default components. An explicit adapter takes
precedence over the package default, including when using the interchangeable Fluent factory or renderer. There is no
global registration or separate renderer factory. Custom components use your existing styles. Radix is supplied by your
app's components; the helpers do not import it, and default consumers do not need Radix types.

Wrappers must forward the props passed by the helper, including children, accessibility attributes and lifecycle
callbacks. Keep native modal behavior and normal unmounting enabled: do not force-mount a closed Radix dialog. Radix CSS
exit animations finish before its close-focus callback removes the entry; Base UI uses its open-change-complete
callback. Add native styling or layout customization inside your wrappers rather than to shared modal options.

## API

- `createModalManager({ labels?, adapter? })`: shared open, alert, confirm and typed modal definitions.
- `ModalRenderer`: renders the manager's adapter; mount once per manager.
- `baseUiComponents(components)` / `radixComponents(components)`: bind the native dialog lifecycle.
- `ModalManager`, `ModalManagerOptions`, `ModalRendererProps`, `ModalSurfaceOptions`: shared contracts.
- `BaseUiModalComponents`, `RadixModalComponents`, `ModalAdapter`: optional integration contracts.

See [lifecycle and architecture](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modals.md),
[typed forms](https://github.com/AndrewCraswell/buildkit/blob/main/docs/modal-forms.md) and
[package guide](docs/README.md).
