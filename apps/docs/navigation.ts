export type PackageEntry = {
  name: string
  layer: string
  guide: string
  entries: { name: string; link: string }[]
}

const routingTitles: Record<string, string> = {
  "router-core": "Core",
  "react-routing": "React bindings",
  "react-router": "React Router",
  "tanstack-router": "TanStack Router"
}

export function packagePages(name: string) {
  return name === "dev-domains" ? [{ text: "CLI reference", link: "/packages/dev-domains/commands" }] : []
}

// Keep the sidebar and generated indexes in the same order without changing package layers or import paths.
export function documentationSections(catalog: PackageEntry[]) {
  const routingOrder = Object.keys(routingTitles)
  return ["Core", "React", "shadcn", "Fluent UI", "Routing", "Developer tools"]
    .map((text) => ({
      text,
      link: text === "Routing" ? "/routing/" : undefined,
      packages: catalog
        .filter((pkg) => (routingTitles[pkg.name] ? "Routing" : pkg.layer) === text)
        .sort((left, right) => routingOrder.indexOf(left.name) - routingOrder.indexOf(right.name))
        .map((pkg) => ({ ...pkg, title: routingTitles[pkg.name] ?? pkg.name }))
    }))
    .filter((section) => section.packages.length > 0)
}
