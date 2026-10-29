import { createRootRoute, HeadContent, Link, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import styles from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Better Apps example" },
      { name: "description", content: "A TanStack Start app that runs Better Apps features." }
    ],
    links: [{ rel: "stylesheet", href: styles }]
  }),
  shellComponent: RootDocument
})

interface RootDocumentProps {
  children: ReactNode
}

function RootDocument({ children }: RootDocumentProps) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container header-inner">
            <Link to="/" className="brand" activeOptions={{ exact: true }}>
              Better Apps example
            </Link>
            <nav aria-label="Main">
              <ul className="nav-list">
                <li>
                  <Link to="/" activeOptions={{ exact: true }}>
                    Notes
                  </Link>
                </li>
                <li>
                  <Link to="/invoices">Invoices</Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main id="main" className="container" tabIndex={-1}>
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}
