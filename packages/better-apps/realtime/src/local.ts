import type { Actor } from "better-apps"
import { broadcastFrame, join, leave, peers, receive, type ConnectionState, type RoomHost } from "./engine.js"
import type { RealtimeAdapter, RoomDefinition } from "./room.js"

/** The parts of a server-side WebSocket the local server uses, as Deno, Bun and `ws` provide them. */
export interface WebSocketLike {
  /** `0` while connecting; the server waits for `open` before welcoming it. */
  readonly readyState?: number | undefined
  send(data: string): void
  close(code?: number, reason?: string): void
  addEventListener(type: "open" | "close", listener: () => void): void
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void
}

/** What an `upgrade` function returns: the server's socket and the response that completes the upgrade. */
export interface Upgrade {
  socket: WebSocketLike
  response: Response
}

/** Options for `localRealtime`. */
export interface LocalRealtimeOptions {
  /**
   * Turns an upgrade request into a socket and its response, such as `Deno.upgradeWebSocket`. The default uses
   * `WebSocketPair`, which workerd and Miniflare have; on Node, pass one built on a WebSocket server.
   */
  upgrade?: ((request: Request) => Upgrade | Promise<Upgrade>) | undefined
}

interface WebSocketPairLike {
  0: WebSocketLike
  1: WebSocketLike & { accept(): void }
}

function pairUpgrade(): Upgrade {
  const WebSocketPair = (globalThis as { WebSocketPair?: new () => WebSocketPairLike }).WebSocketPair
  if (!WebSocketPair) {
    throw new Error(
      "localRealtime needs an upgrade function on runtimes without WebSocketPair, such as Node: " +
        "localRealtime({ upgrade: (request) => ({ socket, response }) })."
    )
  }
  const pair = new WebSocketPair()
  pair[1].accept()
  return { socket: pair[1], response: new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit) }
}

function whenOpen(socket: WebSocketLike): Promise<void> {
  if (socket.readyState !== 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => socket.addEventListener("open", resolve))
}

/**
 * Runs rooms in memory, in this process, for tests and local development without Cloudflare's runtime. Each call makes
 * a separate server; rooms on other processes or isolates don't see each other.
 */
export function localRealtime(options: LocalRealtimeOptions = {}): RealtimeAdapter {
  const rooms = new Map<string, Map<WebSocketLike, ConnectionState>>()

  function hostOf(room: RoomDefinition, key: string): RoomHost {
    const id = `${room.name}/${key}`
    return {
      key,
      entries: () => Array.from(rooms.get(id) ?? [], ([socket, state]) => ({ socket, state })),
      save: (socket, state) => void rooms.get(id)?.set(socket as WebSocketLike, state)
    }
  }

  return {
    async connect(room, key, request, { actor }: { actor: Actor | null }) {
      const { socket, response } = options.upgrade ? await options.upgrade(request) : pairUpgrade()
      const id = `${room.name}/${key}`
      const host = hostOf(room, key)
      const state: ConnectionState = { id: crypto.randomUUID(), actor, presence: null }
      socket.addEventListener("message", (event) => {
        const current = rooms.get(id)?.get(socket)
        if (current && (typeof event.data === "string" || event.data instanceof ArrayBuffer)) {
          void receive(host, room, socket, current, event.data)
        }
      })
      socket.addEventListener("close", () => {
        const members = rooms.get(id)
        const current = members?.get(socket)
        if (!members || !current) {
          return
        }
        members.delete(socket)
        if (members.size === 0) {
          rooms.delete(id)
        }
        void leave(host, room, socket, current)
      })
      void whenOpen(socket).then(() => {
        let members = rooms.get(id)
        if (!members) {
          members = new Map()
          rooms.set(id, members)
        }
        members.set(socket, state)
        return join(host, room, socket, state)
      })
      return response
    },
    async broadcast(room, key, message, except) {
      broadcastFrame(hostOf(room, key), { type: "message", message }, except)
    },
    async connections(room, key) {
      return peers(hostOf(room, key))
    }
  }
}
