# @buildkitgg/tanstack-router

Typed route tabs and panels for TanStack Router.

```tsx
import { createRouterAdapter, useRoutePanel } from "@buildkitgg/tanstack-router"

const adapter = createRouterAdapter(router)
const person = adapter.route({
  to: "/people/$id",
  params: { id: "42" },
  search: true
})
const people = adapter.route({ to: "/people", search: true })

function PersonPanel() {
  const panel = useRoutePanel(adapter, { route: person, closeTo: people })
  return <YourPanel open={panel.isOpen} onOpenChange={panel.setOpen} />
}
```

Native navigation options preserve search, hashes, replace behavior and typed params. Use fuzzy: true in match options
for parent tabs. Native Link owns link behavior. State follows completed navigation.

- createRouterAdapter(router): infer the supplied route tree.
- adapter.route(navigation, match?): validate destinations and required params.
- useRouteTabs / useRoutePanel: shared React behavior.

See [routing architecture](../../../docs/routing.md) for defaults, SSR, history, matching and integration details.
Examples with `YourPanel` use an application-owned component.
