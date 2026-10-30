import type { Actor, StandardSchemaV1 } from "better-apps"
import { realtimeAdapter } from "./backends.js"
import type { Peer } from "./protocol.js"

/** A connection, as a room's hooks see it. */
export interface Connection<Presence = unknown> {
  id: string
  actor: Actor | null
  presence: Presence | null
  /** Sends a message to this connection only. */
  send(message: unknown): void
  close(code?: number, reason?: string): void
}

/** Who to leave out of a broadcast: connection ids or connections. */
export type Except = string | Connection | readonly (string | Connection)[]

/** One room instance, as its hooks see it. */
export interface Room<Presence = unknown> {
  /** The room's declared name. */
  name: string
  /** The instance's key, such as an invoice id. */
  key: string
  connections(): Connection<Presence>[]
  /** Sends a message to everyone in the room, or everyone but `except`. */
  broadcast(message: unknown, options?: { except?: Except | undefined }): void
}

/** What a room's join check receives. */
export interface JoinArgs {
  /** Who is joining, or `null` for a signed-out visitor. */
  actor: Actor | null
  /** The room instance, such as an invoice id. */
  key: string
  request: Request
}

/** How a room checks who joins and what they send, and what it does with messages. */
export interface RoomOptions<Message = unknown, Presence = unknown> {
  /** Checks each client message before `onMessage`. Any Standard Schema, such as a zod schema. */
  message?: StandardSchemaV1<unknown, Message> | undefined
  /** Checks each presence update. Presence is at most 1 KiB of JSON. */
  presence?: StandardSchemaV1<unknown, Presence> | undefined
  /**
   * Says who may join an instance, before the WebSocket opens. The default lets anyone in, so rooms about an app's
   * records check access, such as with `app.subjects.canView(actor, { subjectType, subjectId: key })`.
   */
  canJoin?(args: JoinArgs): boolean | Promise<boolean>
  /** Runs where the room lives after a connection is welcomed. */
  onJoin?(room: Room<Presence>, connection: Connection<Presence>): void | Promise<void>
  /** Runs where the room lives for each client message. Without it, client messages are dropped. */
  onMessage?(room: Room<Presence>, connection: Connection<Presence>, message: Message): void | Promise<void>
  /** Runs where the room lives after a connection closes and the others are told. */
  onLeave?(room: Room<Presence>, connection: Connection<Presence>): void | Promise<void>
}

/** A room's name and options, which adapters run. */
export interface RoomDefinition<Message = unknown, Presence = unknown> {
  readonly name: string
  readonly options: RoomOptions<Message, Presence>
}

/** Options for `connect`. */
export interface ConnectOptions {
  /** The room instance, such as an invoice id. */
  key: string
  /** Who is joining, from the app's identity adapter, or `null` for a signed-out visitor. */
  actor: Actor | null
}

/** Options for a room's `broadcast`. */
export interface BroadcastOptions {
  /** Connection ids to leave out, such as the one whose change caused the broadcast. */
  except?: string | readonly string[] | undefined
}

/** A room declared with `defineRoom`. It finds its adapter on first use. */
export interface RoomHandle<Message = unknown, Presence = unknown> extends RoomDefinition<Message, Presence> {
  /**
   * Answers a WebSocket upgrade request for an instance: runs `canJoin`, then returns the adapter's upgrade response.
   * It answers 426 to a request that isn't a WebSocket upgrade, and 403 when `canJoin` refuses.
   */
  connect(request: Request, options: ConnectOptions): Promise<Response>
  /** Sends a message to everyone in an instance, from server code, such as after a record changes. */
  broadcast(key: string, message: unknown, options?: BroadcastOptions): Promise<void>
  /** Everyone in an instance. */
  connections(key: string): Promise<Peer<Presence>[]>
}

/** Runs rooms on a backend, such as Durable Objects (`durableObjectRealtime`) or in memory (`localRealtime`). */
export interface RealtimeAdapter {
  /** Accepts a WebSocket upgrade for a joiner `canJoin` let in, and returns the upgrade response. */
  connect(room: RoomDefinition, key: string, request: Request, options: { actor: Actor | null }): Promise<Response>
  broadcast(room: RoomDefinition, key: string, message: unknown, except: readonly string[]): Promise<void>
  connections(room: RoomDefinition, key: string): Promise<Peer[]>
}

// Room names become binding and class names, so they're kept to letters, digits and hyphens.
const roomName = /^[a-z][a-z0-9-]{0,62}$/
// Keys name Durable Objects and travel in URLs, so they're kept short.
const maxKeyLength = 512

function validKey(key: string): boolean {
  return key !== "" && key.length <= maxKeyLength
}

function checkKey(key: string): void {
  if (!validKey(key)) {
    throw new Error(`Room keys have 1 to ${maxKeyLength} characters.`)
  }
}

/**
 * Declares a real-time room. Declare it at module top level with a literal name and export it
 * (better-apps-deploy.md §2). Each key is an instance, such as one room per invoice. The adapter comes from
 * `configureBackends`, or is Durable Objects by default, with the binding `REALTIME_<NAME>`.
 */
/*#__NO_SIDE_EFFECTS__*/
export function defineRoom<Message = unknown, Presence = unknown>(
  name: string,
  options: RoomOptions<Message, Presence> = {}
): RoomHandle<Message, Presence> {
  if (!roomName.test(name)) {
    throw new Error(`Room names use lowercase letters, digits and hyphens, start with a letter and fit in 63: ${name}`)
  }
  const handle: RoomHandle<Message, Presence> = {
    name,
    options,
    async connect(request, { key, actor }) {
      if (!validKey(key)) {
        return new Response("Not found", { status: 404 })
      }
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected a WebSocket upgrade", { status: 426, headers: { upgrade: "websocket" } })
      }
      if (options.canJoin && !(await options.canJoin({ actor, key, request }))) {
        return new Response("Forbidden", { status: 403 })
      }
      return (await realtimeAdapter()).connect(handle as RoomDefinition, key, request, { actor })
    },
    async broadcast(key, message, broadcastOptions = {}) {
      checkKey(key)
      const except = broadcastOptions.except ?? []
      const ids = typeof except === "string" ? [except] : [...except]
      await (await realtimeAdapter()).broadcast(handle as RoomDefinition, key, message, ids)
    },
    async connections(key) {
      checkKey(key)
      return (await (await realtimeAdapter()).connections(handle as RoomDefinition, key)) as Peer<Presence>[]
    }
  }
  return handle
}
