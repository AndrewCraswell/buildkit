import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Braces, Check, Layers3, Terminal } from "lucide-react"
import { Architecture } from "./Architecture"
import { GithubIcon } from "./GithubIcon"
import { Header } from "./Header"
import { LinkButton } from "./LinkButton"
import { links } from "./links"
import { ModalExample } from "./ModalExample"
import { PackageCatalog } from "./PackageCatalog"
import { PreferencesExample } from "./PreferencesExample"
import { ThemeExample } from "./ThemeExample"

export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <div className="hero-shell dark">
          <section className="hero container" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="hero-eyebrow">
                <span className="eyebrow-symbol">
                  <Layers3 />
                </span>{" "}
                OPEN-SOURCE FRONTEND LIBRARIES
              </p>
              <h1 id="hero-title">
                The batteries
                <br />
                <span>
                  your frontend
                  <br />
                  is missing.
                </span>
              </h1>
              <p className="hero-description">
                Every app needs more than components. Buildkit packages common design patterns into framework-agnostic
                TypeScript, with bindings for React and adapters for common component libraries.
              </p>
              <div className="hero-actions">
                <LinkButton size="lg" href="#packages" className="hero-primary">
                  Explore packages <ArrowDown aria-hidden="true" />
                </LinkButton>
                <LinkButton size="lg" variant="outline" href={links.docs} className="hero-secondary">
                  Read the docs <ArrowUpRight aria-hidden="true" />
                </LinkButton>
              </div>
              <div className="hero-facts">
                <span>
                  <Check /> MIT licensed
                </span>
                <span>
                  <Check /> Fully typed
                </span>
              </div>
            </div>
            <ThemeExample />
          </section>
        </div>
        <div className="page-content">
          <Architecture />
          <section className="examples-section container" id="examples" aria-label="Interactive examples">
            <PreferencesExample />
            <ModalExample />
          </section>
          <PackageCatalog />
          <section className="section resources-section" id="resources" aria-labelledby="resources-title">
            <div className="container">
              <div className="section-heading">
                <h2 id="resources-title">Documentation</h2>
              </div>
              <div className="resource-grid">
                <a className="resource-link" href={links.docs}>
                  <BookOpen />
                  <h3>Package guides</h3>
                  <p>Installation, usage, and integration requirements for each package.</p>
                  <span>
                    Read the guides <ArrowUpRight />
                  </span>
                </a>
                <a className="resource-link" href={`${links.docs}reference/`}>
                  <Braces />
                  <h3>API reference</h3>
                  <p>Public types and signatures, generated from the package source.</p>
                  <span>
                    Browse the API <ArrowUpRight />
                  </span>
                </a>
                <a className="resource-link" href={links.storybook}>
                  <Terminal />
                  <h3>Storybook</h3>
                  <p>Interactive examples with the code behind each behavior.</p>
                  <span>
                    Open Storybook <ArrowUpRight />
                  </span>
                </a>
              </div>
            </div>
          </section>
          <section className="contribute-section dark" aria-labelledby="contribute-title">
            <div className="container contribute-inner">
              <div>
                <h2 id="contribute-title">Contribute an adapter</h2>
                <p>
                  We welcome bindings for other frameworks and adapters for other component libraries. Reuse the core
                  behavior and connect it to the conventions of the tools you use.
                </p>
                <p>
                  Have an integration in mind? Open an issue to discuss it, or read the contributing guide to get
                  started.
                </p>
              </div>
              <div className="contribute-links">
                <LinkButton size="lg" href={`${links.github}/blob/main/CONTRIBUTING.md`}>
                  Contributing guide <ArrowRight />
                </LinkButton>
                <LinkButton size="lg" variant="outline" href={`${links.github}/issues`}>
                  <GithubIcon /> Discuss an adapter <ArrowUpRight />
                </LinkButton>
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer className="site-footer dark">
        <div className="container footer-inner">
          <a className="brand" href="#top">
            <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" width="28" height="28" />
            buildkit<span>.gg</span>
          </a>
          <nav aria-label="Footer">
            <a href={links.docs}>Docs</a>
            <a href={links.github}>
              GitHub <ArrowUpRight />
            </a>
            <a href={`${links.github}/blob/main/LICENSE`}>MIT license</a>
          </nav>
        </div>
      </footer>
    </>
  )
}
