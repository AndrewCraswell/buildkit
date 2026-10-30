import type { Actor } from "better-apps"

/** Someone in a room, as everyone in it sees them. */
export interface Peer<Presence = unknown> {
  /** The connection's id. One user with two tabs is two peers. */
  id: string
  /** Who joined, or `null` for a signed-out visitor the room let in. */
  actor: Actor | null
  /** What the peer last shared, such as the field they're editing, or `null` before they share anything. */
  presence: Presence | null
}

/** What a room sends to its clients, as JSON text frames. */
export type ServerFrame<Message = unknown, Presence = unknown> =
  /** Sent first, with the connection's own id and everyone else in the room. */
  | { type: "welcome"; id: string; peers: Peer<Presence>[] }
  | { type: "join"; peer: Peer<Presence> }
  | { type: "leave"; id: string }
  | { type: "presence"; id: string; presence: Presence | null }
  /** A message the room or server code broadcast, or sent to this connection. */
  | { type: "message"; message: Message }
  /** A frame from this client the room refused. */
  | { type: "error"; code: string; message: string }

/** What clients send to a room, as JSON text frames. */
export type ClientFrame = { type: "presence"; presence: unknown } | { type: "message"; message: unknown }

/** Clients send this text to keep a connection open; rooms answer `pong` without waking from hibernation. */
export const ping = "ping"
export const pong = "pong"
