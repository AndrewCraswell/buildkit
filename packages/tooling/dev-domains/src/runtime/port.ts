import { createServer } from "node:net"
import { routeStore } from "./state.js"

/** Hold an OS-assigned port until its route is registered, then hand it to the server. */
export async function reservePort() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const server = createServer()
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve)
    })
    const address = server.address()
    let released: Promise<void> | undefined
    const release = () =>
      (released ??= new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }))
    if (!address || typeof address === "string") {
      await release()
      throw new Error("Could not reserve a local server port")
    }
    // Another launcher may have registered its route and released its socket,
    // but its framework has not bound the port yet.
    try {
      if (
        routeStore()
          .loadRoutes()
          .some((route) => route.port === address.port)
      ) {
        await release()
        continue
      }
    } catch (error) {
      await release()
      throw error
    }
    return { port: address.port, release }
  }
  throw new Error("Could not reserve an unused local server port. Try again.")
}
