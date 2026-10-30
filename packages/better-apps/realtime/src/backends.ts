import { getBackend } from "better-apps"
import type { RealtimeAdapter } from "./room.js"

/** Realtime's entry in `configureBackends`. */
export interface RealtimeBackend {
  /** The default is `durableObjectRealtime()`, which finds each room's namespace by its name. */
  adapter?: RealtimeAdapter | undefined
}

declare module "better-apps" {
  interface Backends {
    /** Real-time rooms, declared with `defineRoom` from `@better-apps/realtime`. */
    realtime?: RealtimeBackend | undefined
  }
}

let defaultAdapter: Promise<RealtimeAdapter> | undefined

/** The adapter `configureBackends` chose, or Durable Objects. */
export async function realtimeAdapter(): Promise<RealtimeAdapter> {
  const configured = getBackend("realtime")?.adapter
  if (configured) {
    return configured
  }
  // Loaded only when the app hasn't chosen, so apps on other backends never load the Cloudflare adapter.
  defaultAdapter ??= import("./cloudflare.js").then(
    ({ durableObjectRealtime }) => durableObjectRealtime(),
    (cause: unknown) => {
      defaultAdapter = undefined
      throw new Error(
        "Rooms default to Cloudflare Durable Objects, but cloudflare:workers isn't available here. Choose another " +
          "adapter with configureBackends from better-apps, such as localRealtime() from @better-apps/realtime/local.",
        { cause }
      )
    }
  )
  return defaultAdapter
}
