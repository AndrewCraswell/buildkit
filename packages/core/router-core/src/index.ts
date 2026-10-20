/** A route owned by a router, with no framework or URL parser in core. */
export type RouteTarget = {
  readonly href: string
  isActive(location?: string): boolean
  navigate(): void | Promise<void>
}
export type RouterAdapter = {
  subscribe(listener: () => void): () => void
  getSnapshot(): string
  getServerSnapshot(): string
}
export type RouteTab<TId extends string = string> = { readonly id: TId; readonly route: RouteTarget }
export type RouteTabsOptions<TId extends string> = {
  tabs: readonly RouteTab<TId>[]
  /** Display fallback only; does not redirect or change history. */
  defaultTab?: NoInfer<TId>
}
export function createRouteTabs<const TId extends string>(options: RouteTabsOptions<TId>, location?: string) {
  const { tabs, defaultTab } = options
  const ids = new Set(tabs.map((tab) => tab.id))
  if (ids.size !== tabs.length) {
    throw new Error("Route tab IDs must be unique")
  }
  if (defaultTab !== undefined && !ids.has(defaultTab)) {
    throw new Error("Default tab must be a configured tab")
  }
  return {
    // First match wins: put specific routes before broad parent matches.
    activeTab: tabs.find((tab) => tab.route.isActive(location))?.id ?? defaultTab,
    select(id: TId): void | Promise<void> {
      const tab = tabs.find((item) => item.id === id)
      if (!tab) {
        throw new Error("Unknown route tab")
      }
      if (!tab.route.isActive()) {
        return tab.route.navigate()
      }
    }
  }
}
export type RoutePanelOptions = {
  route: RouteTarget
  /** Explicit destination makes dismissal safe for direct links. */
  closeTo: RouteTarget
  exclude?: readonly RouteTarget[]
}
export function createRoutePanel({ route, closeTo, exclude = [] }: RoutePanelOptions, location?: string) {
  const isActive = (currentLocation?: string) =>
    route.isActive(currentLocation) && !exclude.some((target) => target.isActive(currentLocation))
  function open(): void | Promise<void> {
    if (!isActive()) {
      return route.navigate()
    }
  }
  function close(): void | Promise<void> {
    if (isActive()) {
      return closeTo.navigate()
    }
  }
  return { isOpen: isActive(location), open, close, setOpen: (isOpen: boolean) => (isOpen ? open() : close()) }
}
