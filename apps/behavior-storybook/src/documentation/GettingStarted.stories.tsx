import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, StoryLink } from "./Documentation.js"
import { packages } from "./packages.js"
function WelcomePage() {
  return (
    <Documentation
      title="Build better apps. Keep the building blocks."
      summary="Reusable behavior, typed React bindings, and UI adapters. Adopt one package or compose the layers you need."
    >
      <h2>Find your starting point</h2>
      <ol>
        <li>
          Need ready-made components? Start with{" "}
          <StoryLink id="components-shadcn-baseui-kit--overview">shadcn-baseui-kit</StoryLink>.
        </li>
        <li>
          Adding appearance settings? Choose <StoryLink id="themes-fluentui-theme--overview">Fluent UI</StoryLink> or{" "}
          <StoryLink id="themes-shadcn-theme--overview">shadcn</StoryLink>.
        </li>
        <li>
          Managing settings? Start with <StoryLink id="core-preferences-core--overview">preferences-core</StoryLink> and
          add React bindings if needed.
        </li>
      </ol>
      <h2>Package directory</h2>
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Layer</th>
              <th scope="col">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((item) => (
              <tr key={item.name}>
                <td>
                  <StoryLink id={`${item.group.toLowerCase()}-${item.name}--overview`}>{item.name}</StoryLink>
                </td>
                <td>{item.group}</td>
                <td>{item.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Explore with confidence</h2>
      <p>
        Start with a package overview, then explore its focused examples. Persistent examples use dedicated demo storage
        keys and provide reset controls. Each package overview links to its source and README.
      </p>
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
