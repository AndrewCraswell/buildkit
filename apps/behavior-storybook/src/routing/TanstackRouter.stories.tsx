import { createRouterAdapter } from "@buildkitgg/tanstack-router"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Link
} from "@tanstack/react-router"
import { useState } from "react"
import { RoutingDemo, routingStory, type RoutingScenario } from "./RoutingDemo.js"
function NativeLinks() {
  return (
    <nav className="bk-router-links" aria-label="Direct links">
      <Link to="/people/42">Direct link to Alex</Link>
      <Link to="/settings">Settings link</Link>
    </nav>
  )
}
function makeRouter(initialPath: string) {
  const root = createRootRoute({ component: NativeLinks })
  const people = createRoute({ getParentRoute: () => root, path: "/people" })
  const detail = createRoute({ getParentRoute: () => root, path: "/people/$id" })
  const settings = createRoute({ getParentRoute: () => root, path: "/settings" })
  return createRouter({
    routeTree: root.addChildren([people, detail, settings]),
    history: createMemoryHistory({ initialEntries: [initialPath] })
  })
}
function Example({ initialPath = "/people", scenario }: { initialPath?: string; scenario?: RoutingScenario }) {
  const [router] = useState(() => makeRouter(initialPath))
  const [adapter] = useState(() => createRouterAdapter(router))
  return (
    <RoutingDemo
      scenario={scenario}
      adapter={adapter}
      people={adapter.route({ to: "/people" }, { fuzzy: true })}
      settings={adapter.route({ to: "/settings" })}
      detail={adapter.route({ to: "/people/$id", params: { id: "42" }, search: true })}
      closeTo={adapter.route({ to: "/people", search: true })}
      onBack={() => router.history.back()}
      onForward={() => router.history.forward()}
    >
      <RouterProvider router={router} />
    </RoutingDemo>
  )
}
const meta = { title: "Routing/TanStack Router", component: Example } satisfies Meta<typeof Example>
export default meta
export const RouteTabs: StoryObj<typeof meta> = { ...routingStory("tabs"), name: "Route tabs" }
export const RoutePanel: StoryObj<typeof meta> = { ...routingStory("panel"), name: "Route panel" }
export const BrowserHistory: StoryObj<typeof meta> = { ...routingStory("history"), name: "Browser history" }
export const NativeLinksExample: StoryObj<typeof meta> = { ...routingStory("links"), name: "Native links" }
export const DirectLink: StoryObj<typeof meta> = {
  name: "Direct link",
  ...routingStory("direct"),
  args: { scenario: "direct", initialPath: "/people/42" }
}
