import { ArrowDown, ArrowRight, Braces, Component, Layers3 } from "lucide-react"
import { links } from "./links"

export function Architecture() {
  return (
    <section className="section architecture-section" id="architecture" aria-labelledby="architecture-title">
      <div className="container">
        <div className="section-heading">
          <h2 id="architecture-title">
            How the packages
            <br />
            fit together
          </h2>
          <p>
            The core owns the behavior. Framework bindings connect it to your app, and component adapters provide the
            UI. Changing the UI doesn’t require rewriting the underlying logic.
          </p>
        </div>
        <figure
          className="architecture-diagram"
          aria-label="Component adapters depend on framework bindings, which depend on the core. Your application can use any layer directly."
        >
          <div className="diagram-rail">
            <span>YOUR APPLICATION</span>
            <span>
              Use any layer directly <ArrowDown aria-hidden="true" />
            </span>
          </div>
          <div className="architecture-layers">
            <article className="architecture-layer core-layer">
              <span className="layer-icon">
                <Braces />
              </span>
              <h3>Core</h3>
              <p>State, operations, and lifecycle rules in plain TypeScript. No framework or rendering dependencies.</p>
              <div className="layer-bottom">Runs independently of your UI</div>
            </article>
            <span className="dependency-bridge" aria-hidden="true">
              ←
            </span>
            <article className="architecture-layer">
              <span className="layer-icon">
                <Layers3 />
              </span>
              <h3>Framework bindings</h3>
              <p>Subscribe to core state and connect updates and cleanup to the framework’s rendering lifecycle.</p>
              <div className="layer-bottom">React hooks and renderers</div>
            </article>
            <span className="dependency-bridge" aria-hidden="true">
              ←
            </span>
            <article className="architecture-layer">
              <span className="layer-icon">
                <Component />
              </span>
              <h3>Component adapters</h3>
              <p>Connect the behavior to a component library’s controls, styling, and accessibility primitives.</p>
              <div className="layer-bottom">Replaceable presentation</div>
            </article>
          </div>
          <figcaption className="diagram-caption">
            <span>
              <span aria-hidden="true">←</span> Dependencies point toward the core
            </span>
          </figcaption>
        </figure>
        <div className="architecture-followup">
          <p>Use an existing adapter, supply your own components, or build directly on a core package.</p>
          <a className="text-link" href={`${links.storybook}?path=/story/getting-started--architecture`}>
            Read about the architecture <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}
