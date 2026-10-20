import { ArrowRight, ArrowUpRight, Search, Package, Terminal } from "lucide-react"
import { useState } from "react"
import { packages, packageOverviewId } from "../../behavior-storybook/src/documentation/packages"
import { Button } from "./components/ui/Button"
import { Input } from "./components/ui/Input"
import { links } from "./links"

const filters = ["All packages", "Core", "React", "shadcn", "Fluent UI", "Routing", "Developer tools"]
const routingPackages = new Set(["router-core", "react-routing", "react-router", "tanstack-router"])

export function PackageCatalog() {
  const [filter, setFilter] = useState("All packages")
  const [query, setQuery] = useState("")
  const visiblePackages = packages.filter((pkg) => {
    const groupMatches =
      filter === "All packages" ||
      pkg.group === filter ||
      (filter === "Routing" && routingPackages.has(pkg.name)) ||
      (filter === "Developer tools" && pkg.group === "Tooling")
    return groupMatches && `${pkg.name} ${pkg.summary}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  return (
    <section className="section catalog-section" id="packages" aria-labelledby="packages-title">
      <div className="container">
        <div className="section-heading">
          <h2 id="packages-title">Find a package</h2>
          <p>
            Each package has its own installation guide, public API reference, and examples. Filter by the layer or
            integration you need.
          </p>
        </div>
        <div className="catalog-toolbar">
          <fieldset className="package-filters" aria-label="Filter packages">
            {filters.map((name) => (
              <Button key={name} variant="ghost" aria-pressed={filter === name} onClick={() => setFilter(name)}>
                {name}
              </Button>
            ))}
          </fieldset>
          <div className="package-search">
            <Search aria-hidden="true" />
            <Input
              type="search"
              placeholder="Find a package…"
              aria-label="Search packages"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="catalog-meta">
          <output>
            {visiblePackages.length} {visiblePackages.length === 1 ? "package" : "packages"}
            {query.trim() ? ` matching “${query.trim()}”` : ""}
          </output>
          <span>@buildkitgg /</span>
        </div>
        <div className="package-grid">
          {visiblePackages.map((pkg) => (
            <article className="package-card" key={pkg.name}>
              <div className="package-card-top">
                <span className="package-icon">{pkg.group === "Tooling" ? <Terminal /> : <Package />}</span>
                <span className={`package-group group-${pkg.group.toLowerCase().replaceAll(" ", "-")}`}>
                  {pkg.group === "Tooling" ? "Developer tools" : pkg.group}
                </span>
              </div>
              <h3>
                <a href={`${links.docs}packages/${pkg.name}/`}>
                  {pkg.name}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </h3>
              <p>{pkg.summary}</p>
              <div className="package-links">
                <a href={`${links.docs}packages/${pkg.name}/`} aria-label={`${pkg.name} guide`}>
                  Guide <ArrowRight aria-hidden="true" />
                </a>
                <a
                  href={`${links.storybook}?path=/story/${packageOverviewId(pkg)}`}
                  aria-label={`${pkg.name} examples`}
                >
                  Examples <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
        {visiblePackages.length === 0 && (
          <div className="empty-packages">
            <Search aria-hidden="true" />
            <h3>No matching packages</h3>
            <p>Try a different name or browse all packages.</p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setFilter("All packages")
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <div className="catalog-footer">
          <span>Install packages individually from npm.</span>
          <a className="text-link" href={`${links.docs}reference/`}>
            Browse the API reference <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
