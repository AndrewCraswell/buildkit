import type { Actor } from "better-apps"
import { DurableObject, env } from "cloudflare:workers"
import {
  broadcastFrame,
  join,
  leave,
  peers,
  receive,
  type ConnectionState,
  type RoomHost,
  type RoomSocket
} from "./engine.js"
import { ping, pong, type Peer } from "./protocol.js"
import type { RealtimeAdapter, RoomDefinition, RoomHandle } from "./room.js"

/** The RPC methods a room's Durable Object serves to the adapter. */
interface RoomStub {
  fetch(request: Request): Promise<Response>
  broadcast(key: string, message: unknown, except: readonly string[]): Promise<void>
  connections(key: string): Promise<Peer[]>
}

/** A Durable Object namespace binding: the methods of Cloudflare's `DurableObjectNamespace` that the adapter calls. */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown
  get(id: never): unknown
}

/** Options for `durableObjectRealtime`. */
export interface DurableObjectRealtimeOptions {
  /**
   * Namespace bindings by room name, for rooms whose binding isn't the derived name, such as `{ invoice: env.ROOMS }`.
   * Other rooms read the binding `REALTIME_<NAME>` from `cloudflare:workers`.
   */
  namespaces?: Record<string, DurableObjectNamespaceLike> | undefined
}

/** The instance of a room's Durable Object class. Workers call these methods; apps don't. */
export interface RoomDurableObject {
  fetch(request: Request): Promise<Response>
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void>
  webSocketClose(socket: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void>
  webSocketError(socket: WebSocket, error: unknown): Promise<void>
  broadcast(key: string, message: unknown, except: readonly string[]): Promise<void>
  connections(key: string): Promise<Peer[]>
}

/** A room's Durable Object class, from `roomDurableObject`, to export from the Worker entry. */
export type RoomDurableObjectClass = new (ctx: never, env: never) => RoomDurableObject

// The Worker passes who joined to the Durable Object in this header; Durable Objects are only reachable through stubs.
const joinHeader = "x-better-apps-room-join"

/** The env binding a room uses by default: `invoice` reads `REALTIME_INVOICE`. */
export function realtimeBindingName(room: string): string {
  return `REALTIME_${room.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}`
}

/** The class name a room's Durable Object is exported as by convention: `invoice` is `InvoiceRoom`. */
export function roomClassName(room: string): string {
  const words = room.split(/[^a-zA-Z0-9]+/).filter((word) => word !== "")
  return `${words.map((word) => word[0]!.toUpperCase() + word.slice(1)).join("")}Room`
}

/**
 * Runs rooms on Cloudflare Durable Objects, one class per room, exported with `roomDurableObject`. It's the default
 * adapter: each room reads the namespace binding `REALTIME_<NAME>` from `cloudflare:workers`, unless `namespaces`
 * passes one. Each key is one Durable Object, and server-side broadcasts reach it over RPC.
 */
export function durableObjectRealtime(options: DurableObjectRealtimeOptions = {}): RealtimeAdapter {
  function stub(room: RoomDefinition, key: string): RoomStub {
    const bindingName = realtimeBindingName(room.name)
    const namespace = options.namespaces?.[room.name] ?? (env[bindingName] as DurableObjectNamespaceLike | undefined)
    if (!namespace) {
      throw new Error(
        `Room "${room.name}" has no Durable Object binding ${bindingName}. Bind one to its class, ` +
          `${roomClassName(room.name)}, in the Worker's config, pass it to durableObjectRealtime({ namespaces }), ` +
          "or choose another adapter with configureBackends from better-apps."
      )
    }
    return namespace.get(namespace.idFromName(key) as never) as RoomStub
  }

  return {
    async connect(room, key, request, { actor }) {
      const headers = new Headers(request.headers)
      headers.set(joinHeader, JSON.stringify({ key, actor }))
      return stub(room, key).fetch(new Request(request, { headers }))
    },
    async broadcast(room, key, message, except) {
      await stub(room, key).broadcast(key, message, except)
    },
    async connections(room, key) {
      return stub(room, key).connections(key)
    }
  }
}

/** What a Durable Object's WebSocket carries through hibernation. */
interface Attachment extends ConnectionState {
  key: string
}

interface HibernatingSocket extends RoomSocket {
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}

interface RoomState {
  acceptWebSocket(socket: unknown): void
  getWebSockets(): HibernatingSocket[]
  setWebSocketAutoResponse?(pair: unknown): void
}

interface WorkersGlobals {
  WebSocketPair: new () => Record<0 | 1, HibernatingSocket>
  WebSocketRequestResponsePair?: new (request: string, response: string) => unknown
}

/**
 * Builds a room's Durable Object class. Export it from the Worker entry under the room's class name, and bind it as
 * `REALTIME_<NAME>`:
 *
 * ```ts
 * export const InvoiceRoom = roomDurableObject(invoiceRoom)
 * ```
 *
 * Sockets use WebSocket hibernation, so an idle room costs nothing. Each socket's id, actor and presence travel in its
 * attachment, so a woken object picks up where it left off.
 */
export function roomDurableObject<Message, Presence>(room: RoomHandle<Message, Presence>): RoomDurableObjectClass {
  const definition = room as RoomDefinition
  const globals = globalThis as unknown as WorkersGlobals

  return class extends DurableObject {
    private readonly state: RoomState

    constructor(ctx: never, workerEnv: never) {
      super(ctx, workerEnv)
      this.state = ctx as RoomState
      if (globals.WebSocketRequestResponsePair) {
        // Keep-alive pings get their answer without waking the object.
        this.state.setWebSocketAutoResponse?.(new globals.WebSocketRequestResponsePair(ping, pong))
      }
    }

    private host(key: string): RoomHost {
      return {
        key,
        entries: () =>
          this.state.getWebSockets().flatMap((socket) => {
            const attachment = socket.deserializeAttachment() as Attachment | null
            return attachment?.key === key ? [{ socket, state: attachment }] : []
          }),
        save: (socket, state) => (socket as HibernatingSocket).serializeAttachment({ ...state, key })
      }
    }

    async fetch(request: Request): Promise<Response> {
      const joined = request.headers.get(joinHeader)
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket" || joined === null) {
        return new Response("Expected a WebSocket upgrade", { status: 426 })
      }
      const { key, actor } = JSON.parse(joined) as { key: string; actor: Actor | null }
      const pair = new globals.WebSocketPair()
      const [client, server] = [pair[0], pair[1]]
      const state: ConnectionState = { id: crypto.randomUUID(), actor, presence: null }
      try {
        server.serializeAttachment({ ...state, key } satisfies Attachment)
      } catch {
        // Attachments hold 2 KiB; an actor with that many roles can't join.
        return new Response("The actor is too large to join a room", { status: 400 })
      }
      this.state.acceptWebSocket(server)
      await join(this.host(key), definition, server, state)
      return new Response(null, { status: 101, webSocket: client } as ResponseInit)
    }

    async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
      const hibernating = socket as unknown as HibernatingSocket
      const attachment = hibernating.deserializeAttachment() as Attachment | null
      if (attachment) {
        await receive(this.host(attachment.key), definition, hibernating, attachment, message)
      }
    }

    async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
      await this.closed(socket as unknown as HibernatingSocket, code, reason)
    }

    async webSocketError(socket: WebSocket): Promise<void> {
      await this.closed(socket as unknown as HibernatingSocket, 1011, "WebSocket error")
    }

    private async closed(socket: HibernatingSocket, code: number, reason: string): Promise<void> {
      const attachment = socket.deserializeAttachment() as Attachment | null
      try {
        socket.close(code, reason)
      } catch {
        // Already closed.
      }
      if (attachment) {
        // Clear it, so the closing socket isn't counted while getWebSockets still returns it.
        socket.serializeAttachment(null)
        await leave(this.host(attachment.key), definition, socket, attachment)
      }
    }

    async broadcast(key: string, message: unknown, except: readonly string[]): Promise<void> {
      broadcastFrame(this.host(key), { type: "message", message }, except)
    }

    async connections(key: string): Promise<Peer[]> {
      return peers(this.host(key))
    }
  }
}
