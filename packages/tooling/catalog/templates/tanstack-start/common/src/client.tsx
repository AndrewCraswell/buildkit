import { StartClient } from "@tanstack/react-start/client"
import { StrictMode, startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { appBootstrap } from "./generated/buildkit/client"

/** A step that finishes before the first render, such as loading the visitor's locale. */
type BootstrapStep = () => Promise<void> | void

const steps: BootstrapStep[] = [...appBootstrap.pre, ...appBootstrap.framework, ...appBootstrap.post]

async function start() {
  for (const step of steps) {
    await step()
  }
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>
    )
  })
}

void start()
