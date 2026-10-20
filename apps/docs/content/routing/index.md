# Routing

Connect tabs and panels to the URL using your app’s router. The selected tab and open panel follow navigation, including
direct links and the browser’s Back and Forward buttons. Your application supplies the UI components.

## Choose your integration

Start with the integration for the router your app already uses. Both expose `createRouterAdapter`, `useRouteTabs`, and
`useRoutePanel`, and share the same tab and panel behavior. Route definitions use each router’s own conventions.

| Your app uses             | Package guide                                 | Route targets                                                           |
| ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| React Router data routers | [React Router](/packages/react-router/)       | Concrete paths and React Router match patterns                          |
| TanStack Router           | [TanStack Router](/packages/tanstack-router/) | Typed destinations, parameters, and search options from your route tree |

Create one adapter for your router, define route targets, then bind the hooks to your tabs or panels. Both integrations
export the shared hooks, so you can import them from the integration package.

React Router support uses `createBrowserRouter` or `createMemoryRouter`. A declarative `BrowserRouter` does not expose
the data-router subscription needed by this adapter.

## Tabs and panels

- **Tabs:** bind `activeTab` and `select` to your tab component. The first matching route selects the tab; an optional
  default affects the display without redirecting.
- **Panels:** bind `isOpen` and `setOpen` to your drawer or dialog. An explicit `closeTo` route gives direct links a
  predictable dismissal destination.

Use your router’s native link component for links. Your UI components retain responsibility for labels, keyboard
interaction, focus, and layout.

## Shared layers

Use these directly when connecting another router or building a different framework integration.

| Layer                                      | Responsibility                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Core](/packages/router-core/)             | Framework-independent tab selection, route matching policies, and panel navigation |
| [React bindings](/packages/react-routing/) | Subscribe to a router adapter and derive tab and panel state with React hooks      |

The React Router and TanStack Router packages connect these layers to their respective routers. Each package has its own
guide and generated API reference under this section.
