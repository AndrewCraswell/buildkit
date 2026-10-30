// The room logic every adapter shares: the wire protocol, presence and the room's hooks. Adapters only hold sockets
// and their state, through a RoomHost: the Durable Object keeps them in hibernation attachments, the local server in
// memory.
import type { Actor, StandardSchemaV1 } from "better-apps"
import { ping, pong, type ClientFrame, type Peer, type ServerFrame } from "./protocol.js"
import type { Connection, Room, RoomDefinition } from "./room.js"

/** The parts of a WebSocket a room uses. */
export interface RoomSocket {
  send(data: string): void
  close(code?: number, reason?: string): void
}

/** What a room keeps about each connection. It must survive JSON, since Durable Objects store it with the socket. */
export interface ConnectionState {
  id: string
  actor: Actor | null
  presence: unknown
}

/** One room instance's sockets, as an adapter keeps them. */
export interface RoomHost {
  key: string
  entries(): { socket: RoomSocket; state: ConnectionState }[]
  /** Stores a connection's changed state. Throws when the backend can't hold it. */
  save(socket: RoomSocket, state: ConnectionState): void
}

/** Presence lives in the Durable Object's hibernation attachment, which holds 2 KiB with the actor. */
export const maxPresenceBytes = 1024
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function peerOf(state: ConnectionState): Peer {
  return { id: state.id, actor: state.actor, presence: state.presence ?? null }
}

function sendFrame(socket: RoomSocket, frame: ServerFrame): void {
  try {
    socket.send(JSON.stringify(frame))
  } catch {
    // The socket closed while the frame was on its way; its close handler tells the room.
  }
}

/** Sends a frame to everyone in the room, except the given connection ids. */
export function broadcastFrame(host: RoomHost, frame: ServerFrame, except: readonly string[] = []): void {
  const data = JSON.stringify(frame)
  for (const { socket, state } of host.entries()) {
    if (!except.includes(state.id)) {
      try {
        socket.send(data)
      } catch {
        // As in sendFrame.
      }
    }
  }
}

/** Everyone in the room. */
export function peers(host: RoomHost): Peer[] {
  return host.entries().map(({ state }) => peerOf(state))
}

function exceptIds(except: string | Connection | readonly (string | Connection)[] | undefined): string[] {
  if (except === undefined) {
    return []
  }
  const list = typeof except === "string" || !Array.isArray(except) ? [except as string | Connection] : except
  return list.map((entry) => (typeof entry === "string" ? entry : entry.id))
}

function roomOf(host: RoomHost, definition: RoomDefinition): Room {
  return {
    name: definition.name,
    key: host.key,
    connections: () => host.entries().map(({ socket, state }) => connectionOf(socket, state)),
    broadcast: (message, options) => broadcastFrame(host, { type: "message", message }, exceptIds(options?.except))
  }
}

function connectionOf(socket: RoomSocket, state: ConnectionState): Connection {
  return {
    id: state.id,
    actor: state.actor,
    presence: state.presence ?? null,
    send: (message) => sendFrame(socket, { type: "message", message }),
    close: (code, reason) => socket.close(code, reason)
  }
}

async function validate<Output>(
  schema: StandardSchemaV1<unknown, Output> | undefined,
  value: unknown
): Promise<{ value: Output } | { error: string }> {
  if (!schema) {
    return { value: value as Output }
  }
  const result = await schema["~standard"].validate(value)
  if (result.issues) {
    return { error: result.issues.map((issue) => issue.message).join("; ") }
  }
  return { value: result.value }
}

async function runHook(socket: RoomSocket, hook: () => void | Promise<void>): Promise<void> {
  try {
    await hook()
  } catch (error) {
    console.error(error)
    sendFrame(socket, { type: "error", code: "INTERNAL_ERROR", message: "The room couldn't handle that." })
  }
}

/** Welcomes a connection the adapter has accepted, tells the others, and runs `onJoin`. */
export async function join(
  host: RoomHost,
  definition: RoomDefinition,
  socket: RoomSocket,
  state: ConnectionState
): Promise<void> {
  const others = host.entries().filter((entry) => entry.state.id !== state.id)
  sendFrame(socket, { type: "welcome", id: state.id, peers: others.map((entry) => peerOf(entry.state)) })
  broadcastFrame(host, { type: "join", peer: peerOf(state) }, [state.id])
  const { onJoin } = definition.options
  if (onJoin) {
    await runHook(socket, () => onJoin(roomOf(host, definition), connectionOf(socket, state)))
  }
}

// Each socket's frames are handled one at a time, in order, so a later presence update can't land before an earlier one.
const queues = new WeakMap<RoomSocket, Promise<void>>()

/** Handles a frame from a client: a presence update or a message for `onMessage`. */
export function receive(
  host: RoomHost,
  definition: RoomDefinition,
  socket: RoomSocket,
  state: ConnectionState,
  data: string | ArrayBuffer
): Promise<void> {
  const handled = (queues.get(socket) ?? Promise.resolve()).then(() =>
    runHook(socket, () => handle(host, definition, socket, state, data))
  )
  // A failed frame mustn't stop the ones after it.
  queues.set(
    socket,
    handled.catch(() => undefined)
  )
  return handled
}

async function handle(
  host: RoomHost,
  definition: RoomDefinition,
  socket: RoomSocket,
  state: ConnectionState,
  data: string | ArrayBuffer
): Promise<void> {
  const text = typeof data === "string" ? data : decoder.decode(data)
  if (text === ping) {
    socket.send(pong)
    return
  }
  let frame: ClientFrame
  try {
    frame = JSON.parse(text) as ClientFrame
  } catch {
    sendFrame(socket, { type: "error", code: "INVALID_FRAME", message: "Frames are JSON." })
    return
  }
  if (frame?.type === "presence") {
    const checked = await validate(definition.options.presence, frame.presence)
    if ("error" in checked) {
      sendFrame(socket, { type: "error", code: "INVALID_PRESENCE", message: checked.error })
      return
    }
    const presence = checked.value ?? null
    if (encoder.encode(JSON.stringify(presence)).byteLength > maxPresenceBytes) {
      sendFrame(socket, {
        type: "error",
        code: "PRESENCE_TOO_LARGE",
        message: `Presence is at most ${maxPresenceBytes} bytes of JSON.`
      })
      return
    }
    const next = { ...state, presence }
    try {
      host.save(socket, next)
    } catch {
      sendFrame(socket, { type: "error", code: "PRESENCE_TOO_LARGE", message: "Presence doesn't fit with the actor." })
      return
    }
    broadcastFrame(host, { type: "presence", id: state.id, presence }, [state.id])
    return
  }
  if (frame?.type === "message") {
    const { onMessage } = definition.options
    if (!onMessage) {
      return
    }
    const checked = await validate(definition.options.message, frame.message)
    if ("error" in checked) {
      sendFrame(socket, { type: "error", code: "INVALID_MESSAGE", message: checked.error })
      return
    }
    await runHook(socket, () => onMessage(roomOf(host, definition), connectionOf(socket, state), checked.value))
    return
  }
  sendFrame(socket, { type: "error", code: "INVALID_FRAME", message: "Frames are presence or message." })
}

/** Tells the others a connection left, and runs `onLeave`. */
export async function leave(
  host: RoomHost,
  definition: RoomDefinition,
  socket: RoomSocket,
  state: ConnectionState
): Promise<void> {
  broadcastFrame(host, { type: "leave", id: state.id }, [state.id])
  const { onLeave } = definition.options
  if (onLeave) {
    try {
      await onLeave(roomOf(host, definition), connectionOf(socket, state))
    } catch (error) {
      console.error(error)
    }
  }
}
