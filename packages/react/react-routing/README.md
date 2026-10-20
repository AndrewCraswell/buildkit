# @buildkitgg/react-routing

Provider-free React bindings for route tabs and panels.

```tsx
const tabs = useRouteTabs(adapter, {
  tabs: [{ id: "people", route: peopleRoute }]
})
const panel = useRoutePanel(adapter, { route: personRoute, closeTo: peopleRoute })
// Bind tabs.activeTab / tabs.select to your tabs.
// Bind panel.isOpen / panel.setOpen to your drawer.
```

Uses useSyncExternalStore and cleans up subscriptions. No local copy of URL state. Applications provide their own tabs
and panel components. Create adapters per router and per SSR request.

- useRouteTabs(adapter, options): subscribe and derive activeTab/select.
- useRoutePanel(adapter, options): subscribe and derive isOpen/open/close/setOpen.
- RouterAdapter: subscribe, getSnapshot, getServerSnapshot.

See [routing architecture](../../../docs/routing.md) for defaults, SSR, history, matching and integration details.
Examples with `YourPanel` use an application-owned component.
