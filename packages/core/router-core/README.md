# @buildkitgg/router-core

Framework-independent tab selection and panel navigation policies.

```tsx
const tabs = createRouteTabs({ tabs: [{ id: "people", route: peopleRoute }] })
tabs.activeTab
await tabs.select("people")

const panel = createRoutePanel({ route: personRoute, closeTo: peopleRoute })
await panel.close()
```

Core has no React or router dependency. Route targets delegate matching and navigation. defaultTab is a display
fallback, not a redirect. closeTo makes direct-link dismissal safe.

- createRouteTabs({ tabs, defaultTab? }): infer tab IDs; first match wins.
- createRoutePanel({ route, closeTo, exclude? }): derive isOpen; open, close, setOpen.
- RouteTarget: href, isActive(), navigate().

See [routing architecture](../../../docs/routing.md) for defaults, SSR, history, matching and integration details.
Examples with `YourPanel` use an application-owned component.
