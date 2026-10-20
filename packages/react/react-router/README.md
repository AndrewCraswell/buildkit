# @buildkitgg/react-router

Route tabs and panels for React Router data routers.

```tsx
import { createRouterAdapter, useRoutePanel } from "@buildkitgg/react-router"

const adapter = createRouterAdapter(router)
const person = adapter.route({ to: "/people/42", match: "/people/:id" })
const people = adapter.route({ to: "/people", preserveSearch: true })

function PersonPanel() {
  const panel = useRoutePanel(adapter, { route: person, closeTo: people })
  return <YourPanel open={panel.isOpen} onOpenChange={panel.setOpen} />
}
```

Use createBrowserRouter or createMemoryRouter. Rooted destinations and concrete params are required for navigation.
Native matchPath handles route patterns. Query preservation is opt-in. Use native Link for normal link behavior.

- createRouterAdapter(router): connect a data router without another provider.
- adapter.route({ to, match?, navigate?, preserveSearch? }): create a route target.
- useRouteTabs / useRoutePanel: shared React behavior.

See [routing architecture](../../../docs/routing.md) for defaults, SSR, history, matching and integration details.
Examples with `YourPanel` use an application-owned component.
