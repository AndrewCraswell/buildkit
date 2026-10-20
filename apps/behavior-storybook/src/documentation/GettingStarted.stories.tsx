import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, StoryLink } from "./Documentation.js"
import { packages, packageOverviewId } from "./packages.js"
function WelcomePage() {
  return (
    <Documentation
      title="Buildkit"
      summary="TypeScript packages for preferences, themes, modals, alerts, routing, and UI components."
    >
      <p>
        Core packages are framework agnostic. React packages add bindings. The shadcn and Fluent UI folders contain UI
        integrations.
      </p>
      {(["Core", "React", "shadcn", "Fluent UI", "Tooling"] as const).map((group) => (
        <section className="bk-package-group" key={group}>
          <h2>{group}</h2>
          <div className="bk-package-grid">
            {packages
              .filter((item) => item.group === group)
              .map((item) => (
                <div className="bk-package-link" key={item.name}>
                  <StoryLink id={packageOverviewId(item)}>
                    {item.name} <span aria-hidden="true">↗</span>
                  </StoryLink>
                  <p>{item.summary}</p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </Documentation>
  )
}
function ArchitecturePage() {
  return (
    <Documentation
      title="Shared behavior. Flexible integrations."
      summary="Buildkit extracts common application patterns into independent cores, then adapts them to the framework and UI library your app uses."
    >
      <h2>How the layers fit together</h2>
      <figure className="bk-architecture">
        <div className="bk-architecture-layer">
          <span className="bk-eyebrow">UI integration</span>
          <h3>Match the library</h3>
          <p>Connect shared behavior to components, styling, and library conventions.</p>
        </div>
        <div className="bk-architecture-arrow" aria-hidden="true">
          ↓
        </div>
        <div className="bk-architecture-layer">
          <span className="bk-eyebrow">Framework bindings</span>
          <h3>Fit the framework</h3>
          <p>Adapt subscriptions and lifecycle to the framework’s rendering model.</p>
        </div>
        <div className="bk-architecture-arrow" aria-hidden="true">
          ↓
        </div>
        <div className="bk-architecture-layer bk-architecture-core">
          <span className="bk-eyebrow">Core</span>
          <h3>Own the behavior</h3>
          <p>Define state, operations, and rules independently of frameworks and UI libraries.</p>
        </div>
        <figcaption>
          Arrows mean “builds on.” An integration can use the core directly when framework bindings aren’t needed.
        </figcaption>
      </figure>
      <h2>Extract once, adapt where needed</h2>
      <p>
        Common behavior belongs in the core. Integrations add only what their framework or library requires, keeping the
        underlying rules consistent across applications.
      </p>
      <h2>Keep dependencies pointing inward</h2>
      <p>
        Integrations depend on core behavior. Core packages never depend on the frameworks or UI libraries that use
        them. This keeps the behavior reusable as application technology changes.
      </p>
      <h2>Adopt only what your app needs</h2>
      <p>
        Use a core directly or choose an integration that fits your app. Public APIs describe the behavior consumers
        need; internal composition stays behind that API.
      </p>
    </Documentation>
  )
}
const meta = {
  title: "Getting started",
  parameters: { layout: "fullscreen", controls: { disable: true } }
} satisfies Meta
export default meta
export const Welcome: StoryObj<typeof meta> = { render: () => <WelcomePage /> }
export const Architecture: StoryObj<typeof meta> = { render: () => <ArchitecturePage /> }
