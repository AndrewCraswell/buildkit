import { Link, type ErrorComponentProps } from "@tanstack/react-router"

/** Shown for an address no route matches. */
export function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p>There’s nothing at this address.</p>
      <Link to="/">Go to the home page</Link>
    </main>
  )
}

/** Shown when a route fails to load or render. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="page" role="alert">
      <h1>Something went wrong</h1>
      <p>{error instanceof Error ? error.message : "This page couldn’t load."}</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
