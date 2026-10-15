import path from "node:path"
import { RouteStore, resolveUserHome } from "portless"

export function stateDirectory() {
  return process.env.PORTLESS_STATE_DIR || path.join(resolveUserHome(), ".portless")
}

export function routeStore() {
  return new RouteStore(stateDirectory())
}
