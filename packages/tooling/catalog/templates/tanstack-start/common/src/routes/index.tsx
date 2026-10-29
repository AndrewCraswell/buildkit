import { createFileRoute } from "@tanstack/react-router"
import { appName } from "../app/site"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return (
    <main className="page">
      <h1>{appName}</h1>
      <p>
        Edit <code>src/routes/index.tsx</code> to change this page, or add a route in <code>src/routes</code>.
      </p>
    </main>
  )
}
