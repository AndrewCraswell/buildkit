import type { Actor } from "better-apps"
import type { RoomHandle } from "./room.js"

/** Options for `handleRooms`. */
export interface HandleRoomsOptions {
  /** The rooms it serves. Requests for other names get 404. */
  rooms: readonly RoomHandle[]
  /** Allowed browser origins. Defaults to the request URL origin; requests without Origin are allowed. */
  allowedOrigins?: readonly string[] | undefined
  /** Reads who is joining, such as `(request) => identity.getActor(request)`. */
  getActor: (request: Request) => Actor | null | Promise<Actor | null>
  /** The default is `/api/rooms`. */
  basePath?: string | undefined
}

/**
 * Answers WebSocket upgrades at `GET {basePath}/{room}/{key}` for the listed rooms, and returns `null` for any other
 * request, so it can run before the app's own handler. Call it in the Worker entry, before frameworks that might copy
 * the response and drop its WebSocket.
 */
export async function handleRooms(request: Request, options: HandleRoomsOptions): Promise<Response | null> {
  const base = `${(options.basePath ?? "/api/rooms").replace(/\/+$/, "")}/`
  const { pathname } = new URL(request.url)
  if (!pathname.startsWith(base)) {
    return null
  }
  const rest = pathname.slice(base.length)
  const slash = rest.indexOf("/")
  const name = slash === -1 ? rest : rest.slice(0, slash)
  const room = options.rooms.find((candidate) => candidate.name === name)
  let key: string
  try {
    key = slash === -1 ? "" : decodeURIComponent(rest.slice(slash + 1))
  } catch {
    key = ""
  }
  if (!room || key === "") {
    return new Response("Not found", { status: 404 })
  }
  if (request.method !== "GET") {
    return new Response(null, { status: 405, headers: { allow: "GET" } })
  }
  const origin = request.headers.get("origin")
  if (origin !== null && !(options.allowedOrigins ?? [new URL(request.url).origin]).includes(origin)) {
    return new Response("Forbidden origin", { status: 403 })
  }
  return room.connect(request, { key, actor: await options.getActor(request) })
}
