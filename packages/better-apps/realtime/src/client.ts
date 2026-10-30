import { createStore } from "better-apps/client"
import { ping, pong, type ClientFrame, type Peer, type ServerFrame } from "./protocol.js"

export type { Peer, ServerFrame } from "./protocol.js"

/** A room connection's state, for `subscribe` and React's `useSyncExternalStore`. */
export interface RoomSnapshot<Presence = unknown> {
  status: "connecting" | "open" | "closed"
  /** This connection's id, once welcomed. It changes after a reconnect. */
  id: string | null
  /** Everyone else in the room. */
  peers: readonly Peer<Presence>[]
  /** What this connection shares. */
  presence: Presence | null
}

/** Options for `joinRoom`. */
export interface JoinRoomOptions<Message, Presence> {
  /** Presence to share on join and after every reconnect. */
  presence?: Presence | undefined
  /** Receives messages the room broadcasts or sends to this connection. */
  onMessage?: ((message: Message) => void) | undefined
  /** Receives frames the room refused, such as presence over its size limit. */
  onError?: ((error: { code: string; message: string }) => void) | undefined
  /** The WebSocket constructor. The default is the global one. */
  WebSocket?: typeof WebSocket | undefined
  /** Milliseconds between keep-alive pings. The default is 30000; `0` turns them off. */
  pingInterval?: number | undefined
}

/** A connection to a room instance, from `joinRoom`. It reconnects with backoff until `leave` is called. */
export interface RoomConnection<Message = unknown, Presence = unknown> {
  getSnapshot(): RoomSnapshot<Presence>
  /** Calls the listener after each change, and returns a function that stops it. */
  subscribe(listener: () => void): () => void
  /** Shares presence with the room, now and after each reconnect. */
  setPresence(presence: Presence): void
  /** Sends a message to the room's `onMessage`. Returns `false` when the connection isn't open. */
  send(message: Message): boolean
  /** Closes the connection for good. */
  leave(): void
}

const maxBackoff = 30_000

function socketUrl(url: string | URL): string {
  const base = (globalThis as { location?: { href: string } }).location?.href
  const resolved = new URL(url, base)
  if (resolved.protocol === "http:" || resolved.protocol === "https:") {
    resolved.protocol = resolved.protocol === "https:" ? "wss:" : "ws:"
  }
  return resolved.href
}

/**
 * Joins a room instance from the browser, at the URL the server answers with `connect` or `handleRooms`, such as
 * `/api/rooms/invoice/42`. It keeps the list of peers and their presence, and reconnects with backoff when the
 * connection drops. `Incoming` types the messages the room sends, and `Outgoing` the ones this client sends.
 */
export function joinRoom<Incoming = unknown, Outgoing = unknown, Presence = unknown>(
  url: string | URL,
  options: JoinRoomOptions<Incoming, Presence> = {}
): RoomConnection<Outgoing, Presence> {
  const Socket = options.WebSocket ?? globalThis.WebSocket
  const target = socketUrl(url)
  const store = createStore<RoomSnapshot<Presence>>({
    status: "connecting",
    id: null,
    peers: [],
    presence: options.presence ?? null
  })
  let socket: WebSocket | undefined
  let attempts = 0
  let left = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let keepAlive: ReturnType<typeof setInterval> | undefined

  function sendFrame(frame: ClientFrame): boolean {
    if (!socket || socket.readyState !== Socket.OPEN || store.getSnapshot().status !== "open") {
      return false
    }
    socket.send(JSON.stringify(frame))
    return true
  }

  function handle(frame: ServerFrame<Incoming, Presence>): void {
    switch (frame.type) {
      case "welcome": {
        attempts = 0
        store.setState((state) => ({ ...state, status: "open", id: frame.id, peers: frame.peers }))
        const { presence } = store.getSnapshot()
        if (presence !== null) {
          sendFrame({ type: "presence", presence })
        }
        break
      }
      case "join":
        store.setState((state) => ({
          ...state,
          peers: [...state.peers.filter((peer) => peer.id !== frame.peer.id), frame.peer]
        }))
        break
      case "leave":
        store.setState((state) => ({ ...state, peers: state.peers.filter((peer) => peer.id !== frame.id) }))
        break
      case "presence":
        store.setState((state) => ({
          ...state,
          peers: state.peers.map((peer) => (peer.id === frame.id ? { ...peer, presence: frame.presence } : peer))
        }))
        break
      case "message":
        options.onMessage?.(frame.message)
        break
      case "error":
        options.onError?.({ code: frame.code, message: frame.message })
        break
    }
  }

  function connect(): void {
    const current = new Socket(target)
    socket = current
    current.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string" || event.data === pong) {
        return
      }
      try {
        handle(JSON.parse(event.data) as ServerFrame<Incoming, Presence>)
      } catch {
        // Not a frame this client knows.
      }
    })
    current.addEventListener("close", () => {
      if (socket !== current) {
        return
      }
      clearInterval(keepAlive)
      if (left) {
        store.setState((state) => ({ ...state, status: "closed", peers: [] }))
        return
      }
      store.setState((state) => ({ ...state, status: "connecting", id: null, peers: [] }))
      const delay = Math.min(maxBackoff, 500 * 2 ** attempts) * (0.5 + Math.random() / 2)
      attempts += 1
      retry = setTimeout(connect, delay)
    })
    const interval = options.pingInterval ?? 30_000
    if (interval > 0) {
      keepAlive = setInterval(() => {
        if (current.readyState === Socket.OPEN) {
          current.send(ping)
        }
      }, interval)
    }
  }

  connect()

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    setPresence(presence) {
      store.setState((state) => ({ ...state, presence }))
      sendFrame({ type: "presence", presence })
    },
    send: (message) => sendFrame({ type: "message", message }),
    leave() {
      left = true
      clearTimeout(retry)
      clearInterval(keepAlive)
      store.setState((state) => ({ ...state, status: "closed", peers: [] }))
      socket?.close(1000, "Left the room")
    }
  }
}
