# Localization and direction

[Documentation](README.md)

Every style re-exports the same `@buildkitgg/shadcn-runtime` provider and configuration. No translation framework is
required. Components use English defaults when no provider is present.

```tsx
import { ShadcnLocalizationProvider } from "@buildkitgg/shadcn-baseui-kit"

;<ShadcnLocalizationProvider
  direction="rtl"
  strings={{
    close: t("close"),
    showOptions: t("showOptions"),
    clear: t("clear"),
    removeItem: (label) => t("removeItem", { label })
  }}
>
  <App />
</ShadcnLocalizationProvider>
```

Set `lang` and `dir` on the document as well, for example `<html lang="ur" dir="rtl">`. The localization provider
controls Base UI behavior; the HTML attribute controls layout and inherited direction, including body portals. For
independently directed regions, set both and give portaled content the matching direction/container.

Logical spacing, alignment, icon direction, and horizontal translations are generated for all styles. Sheet and sidebar
`left`/`right` selections follow the start/end edges in RTL. Carousel direction follows the localization provider unless
explicitly overridden through its options. Do not apply a second RTL transform to the published components.

## Strongly typed strings

`ShadcnStrings` is the complete typed dictionary; `defaultShadcnStrings` exposes its English defaults. It covers dialog
and sheet close controls, sidebar controls, command defaults, pagination, breadcrumbs, carousel descriptions, toast
closing, loading, copying, combobox actions, and manager actions. `useShadcnLocalization()` returns
`{ strings, direction }`. The dictionary is complete and readonly, and direction is `"ltr" | "rtl"`. Unknown keys,
incorrect string values, and incorrect formatter arguments are TypeScript errors. The provider accepts
`Partial<ShadcnStrings>`; missing translations are resolved before the hook returns.

Partial dictionaries inherit from the nearest provider, then English. Nested providers override only supplied values;
`undefined` inherits. Changing the dictionary updates mounted components and React portals. Server requests do not share
localization state. Keep translated dictionaries in the application and use its existing translation framework.

Explicit component props take precedence wherever the component exposes them, including command titles, pagination text,
and accessible-name props. Internal close controls use the provider. Combobox icon triggers and clear buttons have
default accessible names. String chip children use `removeItem(label)`; complex chip content should supply
`removeLabel`. A trigger with visible children retains its content-based name unless explicitly overridden.

Spinner defaults to a localized status. When surrounding text already supplies the announcement, use
`<Spinner aria-hidden="true" role={undefined} />` to make it decorative.

Modal-manager defaults read this provider at render time. Explicit manager labels and per-modal labels take precedence.
Alert regions use `notifications` and `dismiss`; explicit `label` and `dismissLabel` props take precedence. Application
content, dates, numbers, and third-party widgets' own locale APIs remain the application's responsibility.

## Using the hook

```tsx
import { useShadcnLocalization } from "@buildkitgg/shadcn-baseui-kit"

function RemoveButton({ name }: { name: string }) {
  const { strings, direction } = useShadcnLocalization()
  return (
    <button dir={direction} aria-label={strings.removeItem(name)}>
      {strings.remove}
    </button>
  )
}
```

Nested providers inherit both strings and direction unless explicitly overridden. Without a provider, the hook returns
English strings and `ltr`. The provider supplies Base UI direction internally; no second provider import is needed.
There is no factory or external store. Update provider props to change the language and direction.

## Custom class merging

Register your application's existing merger once before rendering, identically on server and client:

```ts
import { setCn } from "@buildkitgg/shadcn-baseui-kit"
import { cn } from "./utils"

setCn(cn)
```

`setCn` accepts a `CnFunction`: `(...inputs: ClassValue[]) => string`. Every generated component delegates to that
function, including components imported before registration. `setCn()` restores the default merger. Your function can
use `createCn` from `cn/config` or another compatible implementation; the kit does not require a second configuration.
Do not pass the kit's delegating `cn` back to `setCn`, or call it from your replacement: that would recurse.

This is process-wide application configuration, not request-specific state. Do not change it during rendering or per
tenant. Ensure kits resolve one compatible runtime version; the provider and merger must share the same module instance.
