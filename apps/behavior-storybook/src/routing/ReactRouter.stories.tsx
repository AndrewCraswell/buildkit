import { createRouterAdapter } from "@buildkitgg/react-router"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState, useEffect } from "react"
import { createMemoryRouter, RouterProvider, Link } from "react-router"
import { RoutingDemo, routingStory, type RoutingScenario } from "./RoutingDemo.js"
function NativeLinks() {
  return (
    <nav className="bk-router-links" aria-label="Direct links">
      <Link to="/people/42">Direct link to Alex</Link>
      <Link to="/settings">Settings link</Link>
    </nav>
  )
}
function Example({ initialPath = "/people", scenario }: { initialPath?: string; scenario?: RoutingScenario }) {
  const [router] = useState(() =>
    createMemoryRouter([{ path: "*", element: <NativeLinks /> }], { initialEntries: [initialPath] })
  )
  const [adapter] = useState(() => createRouterAdapter(router))
  useEffect(() => {
    router.initialize()
    return () => router.dispose()
  }, [router])
  return (
    <RoutingDemo
      scenario={scenario}
      adapter={adapter}
      people={adapter.route({ to: "/people", match: { path: "/people", end: false } })}
      settings={adapter.route({ to: "/settings" })}
      detail={adapter.route({ to: "/people/42", match: "/people/:id", preserveSearch: true })}
      closeTo={adapter.route({ to: "/people", preserveSearch: true })}
      onBack={() => void router.navigate(-1)}
      onForward={() => void router.navigate(1)}
    >
      <RouterProvider router={router} />
    </RoutingDemo>
  )
}
const meta = { title: "Routing/React Router", component: Example } satisfies Meta<typeof Example>
export default meta
export const RouteTabs: StoryObj<typeof meta> = { ...routingStory("tabs"), name: "Route tabs" }
export const RoutePanel: StoryObj<typeof meta> = { ...routingStory("panel"), name: "Route panel" }
export const BrowserHistory: StoryObj<typeof meta> = { ...routingStory("history"), name: "Browser history" }
export const NativeLinksExample: StoryObj<typeof meta> = { ...routingStory("links"), name: "Native links" }
export const DirectLink: StoryObj<typeof meta> = {
  name: "Direct link",
  ...routingStory("direct"),
  args: { scenario: "direct", initialPath: "/people/42?filter=active" }
}
