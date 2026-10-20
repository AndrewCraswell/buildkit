import { useRouteTabs, useRoutePanel, type RouterAdapter, type RouteTarget } from "@buildkitgg/react-routing"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button
} from "@buildkitgg/shadcn-baseui-kit"
import { useSyncExternalStore, type ReactNode } from "react"
export type RoutingScenario = "tabs" | "panel" | "history" | "direct" | "links"
export function routingStory(scenario: RoutingScenario) {
  let code: string | undefined
  if (scenario === "tabs") {
    code =
      'const tabs = useRouteTabs(adapter, {\n  tabs: [\n    { id: "people", route: peopleRoute },\n    { id: "settings", route: settingsRoute }\n  ]\n})\n\n<Tabs\n  value={tabs.activeTab ?? null}\n  onValueChange={(value) => {\n    if (value === "people" || value === "settings") {\n      void tabs.select(value)\n    }\n  }}\n>\n  {/* Your tab triggers and content */}\n</Tabs>'
  } else if (scenario === "panel" || scenario === "direct") {
    code =
      "const panel = useRoutePanel(adapter, {\n  route: personRoute,\n  closeTo: peopleRoute\n})\n\n<Sheet\n  open={panel.isOpen}\n  onOpenChange={(open) => void panel.setOpen(open)}\n>\n  {/* Your panel content */}\n</Sheet>"
  }
  const descriptions = {
    tabs: "Select a section to navigate. The active tab is derived from the current route.",
    panel: "Open a person’s details in a side panel. Opening and closing both update the route.",
    history: "Switch sections, then use Back and Forward to restore the selected tab.",
    direct: "Start at a person’s URL. The panel can close to its list without relying on a previous page.",
    links: "Navigate through native router links. Buildkit observes the route without intercepting link behavior."
  }
  return {
    args: { scenario },
    parameters: {
      docs: {
        description: { story: descriptions[scenario] },
        source: { code }
      }
    }
  }
}
export type RoutingDemoProps = {
  adapter: RouterAdapter
  people: RouteTarget
  settings: RouteTarget
  detail: RouteTarget
  closeTo: RouteTarget
  onBack(): void
  onForward(): void
  children?: ReactNode
  scenario?: RoutingScenario
}
function PeopleList() {
  return (
    <div className="bk-stack">
      {[
        { name: "Alex Morgan", initials: "AM", role: "Product designer" },
        { name: "Jamie Chen", initials: "JC", role: "Frontend engineer" }
      ].map((person) => (
        <div className="bk-person" key={person.name}>
          <div className="bk-avatar" aria-hidden="true">
            {person.initials}
          </div>
          <div>
            <p className="bk-item-title">{person.name}</p>
            <p className="bk-item-description">{person.role}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
export function RoutingDemo({
  adapter,
  people,
  settings,
  detail,
  closeTo,
  onBack,
  onForward,
  children,
  scenario = "tabs"
}: RoutingDemoProps) {
  const location = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getServerSnapshot)
  const tabs = useRouteTabs(adapter, {
    tabs: [
      { id: "people", route: people },
      { id: "settings", route: settings }
    ]
  })
  const panel = useRoutePanel(adapter, { route: detail, closeTo })
  return (
    <section className="bk-stack">
      <div className="bk-route-location">
        <span>Location</span>
        <output aria-label="Current route">{location}</output>
      </div>
      {scenario === "history" && (
        <div className="actions">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={onForward}>
            Forward
          </Button>
        </div>
      )}
      {(scenario === "tabs" || scenario === "history") && (
        <Tabs
          value={tabs.activeTab ?? null}
          onValueChange={(value) => {
            if (value === "people" || value === "settings") {
              void tabs.select(value)
            }
          }}
        >
          <TabsList variant="line" aria-label="Workspace sections">
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="people" className="bk-route-content">
            <PeopleList />
          </TabsContent>
          <TabsContent value="settings" className="bk-route-content">
            <div className="bk-row">
              <div>
                <p className="bk-item-title">Workspace visibility</p>
                <p className="bk-item-description">Only invited members can access this workspace.</p>
              </div>
              <span>Private</span>
            </div>
          </TabsContent>
        </Tabs>
      )}
      {(scenario === "panel" || scenario === "direct") && (
        <div className="bk-row">
          <div className="bk-person">
            <div className="bk-avatar" aria-hidden="true">
              AM
            </div>
            <div>
              <p className="bk-item-title">Alex Morgan</p>
              <p className="bk-item-description">Product designer</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void panel.open()}>
            View profile
          </Button>
        </div>
      )}
      <Sheet open={panel.isOpen} onOpenChange={(isOpen) => void panel.setOpen(isOpen)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Alex Morgan</SheetTitle>
            <SheetDescription>Product designer</SheetDescription>
          </SheetHeader>
          <div className="bk-panel-body">
            <dl className="bk-detail-list">
              <div>
                <dt>Email</dt>
                <dd>alex@example.com</dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>Design systems</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Workspace member</dd>
              </div>
            </dl>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => void panel.close()}>
              Back to people
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <div hidden={scenario !== "links"}>{children}</div>
    </section>
  )
}
