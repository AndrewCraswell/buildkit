# Route tabs and panels

The URL is the source of truth. Buildkit does not maintain a second selected tab or panel-open store, parse router
patterns, or intercept link clicks.

| Package         | Responsibility                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| router-core     | Typed tab IDs, first-match selection, optional display fallback, exclusions, guarded navigation and explicit panel dismissal |
| react-routing   | Subscribe with useSyncExternalStore; derive state during rendering; unsubscribe on unmount                                   |
| react-router    | React Router data-router subscriptions, native matchPath and navigation                                                      |
| tanstack-router | TanStack Router subscriptions, typed destinations and params, native matching and navigation                                 |

Create one adapter per router. Create a new router and adapter per SSR request, and initialize the client with the same
location. The adapter captures its initial location for getServerSnapshot. Route targets read current router state when
invoked, so retained commands do not use stale open/closed state. No Buildkit provider is needed; native Link components
still require their router provider.

## Behavior

Tabs use the first matching route in configured order. Put specific matches before broad parents. Unknown routes have no
selected tab unless defaultTab supplies a display fallback. Reading state never redirects. Duplicate IDs and invalid
defaults throw. Navigation returns the router promise so applications can handle failures.

Panels receive a route and an explicit closeTo destination. Closing an inactive panel is a no-op. Opening an active
panel is a no-op. Exclusions override matching. Closing pushes history by default; configure replace on the close
destination when appropriate. Back/forward behavior remains native. A direct-linked panel can always close without
relying on a previous in-app history entry.

React Router destinations are rooted paths. Pattern matches may use dynamic parameters, but the navigation destination
must be concrete. preserveSearch retains the current query only when no explicit query was supplied. Hashes and
navigation options are forwarded. The adapter supports createBrowserRouter and createMemoryRouter; declarative
BrowserRouter is not a data router.

TanStack destinations use its native typed navigation options, including params, search reducers, hash, replace, and
route-relative from/to. search: true explicitly preserves search. Native match options support fuzzy parent matches and
search matching. The adapter observes completed navigation through onResolved. Buildkit does not reproduce the router's
route tree or validation.

Use the native Link components for links and modified clicks. Bind UI tabs to activeTab/select and drawers or dialogs to
isOpen/setOpen. Applications own labels, focus, layout, and accessibility through their UI primitives. No shadcn or
Fluent package is needed for this behavior.

The existing fluentui-react-router implementation informed these boundaries. Prefetch caches and link shims are
deliberately outside this change; use each router's native loading and preloading facilities.

References: [React Router matchPath](https://reactrouter.com/api/utils/matchPath),
[TanStack Router type utilities](https://tanstack.com/router/latest/docs/framework/react/guide/type-utilities),
[TanStack navigation](https://tanstack.com/router/latest/docs/framework/react/guide/navigation).
