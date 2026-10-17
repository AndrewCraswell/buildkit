import type { Meta, StoryObj } from "@storybook/react-vite"
import { Documentation, Code, StoryLink } from "./Documentation.js"
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
      <p>
        The component kit is published. The behavior packages are implemented locally and remain unpublished while their
        APIs are reviewed.
      </p>
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Layer</th>
              <th scope="col">Availability</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((item) => (
              <tr key={item.name}>
                <td>
                  <StoryLink id={`${item.group.toLowerCase()}-${item.name}--overview`}>{item.name}</StoryLink>
                </td>
                <td>{item.group}</td>
                <td>{item.name === "shadcn-baseui-kit" ? "Published 0.1.0" : "Unpublished"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Explore with confidence</h2>
      <p>
        Start with a package overview, then explore its focused examples. Persistent examples use dedicated demo storage
        keys and provide reset controls. Source links lead to the repository; unreleased work may not be on its default
        branch yet.
      </p>
    </Documentation>
  )
}
function ArchitecturePage() {
  return (
    <Documentation
      title="Small packages. Clear boundaries."
      summary="Core behavior stays independent of React and the UI library you choose."
    >
      <h2>Three layers</h2>
      <ol>
        <li>
          <strong>Core:</strong> state, defaults, subscriptions, and persistence.
        </li>
        <li>
          <strong>React:</strong> typed hooks using useSyncExternalStore. Your app owns its stores.
        </li>
        <li>
          <strong>UI adapters:</strong> shadcn document styling or Fluent native provider integration.
        </li>
      </ol>
      <Code>
        {
          "preferences-core → theme-core → shadcn-theme\n                    ↓\n                react-theme → fluentui-theme\npreferences-core → react-preferences"
        }
      </Code>
      <h2>Defaults and user choices</h2>
      <p>
        Themes default to system. Set defaultTheme to light or dark for another starting point. A saved choice takes
        precedence. reset() removes the override and restores the app default.
      </p>
      <h2>Storage and server rendering</h2>
      <p>
        localStorage synchronizes same-origin tabs. sessionStorage is tab-specific. Create stores per server request,
        keep initial server/client defaults consistent, and connect browser effects at the app boundary.
      </p>
      <h2>Use your existing components</h2>
      <p>
        The shadcn adapter supports registry components using .dark. Fluent UI is supplied by the consuming app as a
        peer. Neither adapter requires the Buildkit component kit.
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
