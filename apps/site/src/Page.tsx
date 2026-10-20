import { StrictMode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { App } from "./App"
import { links } from "./links"

function PageError() {
  return (
    <main className="page-error">
      <h1>Something didn’t load.</h1>
      <p>Refresh the page or continue to the documentation.</p>
      <a href={links.docs}>Open the docs</a>
    </main>
  )
}

export function Page() {
  return (
    <StrictMode>
      <ErrorBoundary FallbackComponent={PageError}>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}
