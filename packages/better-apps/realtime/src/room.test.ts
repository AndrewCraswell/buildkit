import { configureBackends, type Actor, type StandardSchemaV1 } from "better-apps"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { realtimeBindingName, roomClassName } from "./cloudflare.js"
import { defineRoom, handleRooms, type RoomHandle, type ServerFrame } from "./index.js"
import { localRealtime, type WebSocketLike } from "./local.js"

type Listener = (event: { data: unknown }) => void

/** The server's end of a connection, with helpers that act as the browser on the other end. */
class FakeSocket implements WebSocketLike {
  readyState = 1
  frames: (ServerFrame | string)[] = []
  closedWith: { code?: number | undefined; reason?: string | undefined } | undefined
  private readonly listeners: Record<string, Listener[]> = { open: [], close: [], message: [] }

  send(data: string): void {
    this.frames.push(data === "pong" ? data : (JSON.parse(data) as ServerFrame))
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
    this.emit("close", { data: undefined })
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners[type]!.push(listener)
  }

  emit(type: string, event: { data: unknown }): void {
    for (const listener of this.listeners[type]!) {
      listener(event)
    }
  }

  /** The browser sends a frame. */
  say(frame: unknown): void {
    this.emit("message", {
      data: typeof frame === "string" || frame instanceof ArrayBuffer ? frame : JSON.stringify(frame)
    })
  }

  /** The browser goes away. */
  disconnect(): void {
    this.emit("close", { data: undefined })
  }

  last(): ServerFrame | string | undefined {
    return this.frames.at(-1)
  }
}

const alice: Actor = { userId: "alice", orgId: null, roles: [] }
const bob: Actor = { userId: "bob", orgId: null, roles: [] }
let nextSocket: FakeSocket

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function upgradeRequest(url = "https://app.test/api/rooms/chat/lobby"): Request {
  return new Request(url, { headers: { upgrade: "websocket" } })
}

async function join(room: RoomHandle<never, never> | RoomHandle, key: string, actor: Actor | null) {
  const socket = new FakeSocket()
  nextSocket = socket
  const response = await (room as RoomHandle).connect(upgradeRequest(), { key, actor })
  await flush()
  return { socket, response }
}

function schema<Output>(
  check: (value: unknown) => value is Output,
  message: string
): StandardSchemaV1<unknown, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => (check(value) ? { value } : { issues: [{ message }] })
    }
  }
}

beforeEach(() => {
  configureBackends({
    realtime: {
      adapter: localRealtime({ upgrade: () => ({ socket: nextSocket, response: new Response("upgraded") }) })
    }
  })
})

afterEach(() => {
  configureBackends({ realtime: undefined })
  vi.restoreAllMocks()
})

describe("a room on the local server", () => {
  it("welcomes connections and keeps everyone's presence", async () => {
    const chat = defineRoom("chat")
    const first = await join(chat, "lobby", alice)

    expect(await first.response.text()).toBe("upgraded")
    expect(first.socket.frames).toEqual([{ type: "welcome", id: expect.any(String), peers: [] }])
    const aliceId = (first.socket.frames[0] as { id: string }).id

    first.socket.say({ type: "presence", presence: { typing: true } })
    const second = await join(chat, "lobby", bob)
    const bobId = (second.socket.frames[0] as { id: string }).id

    expect(second.socket.frames[0]).toEqual({
      type: "welcome",
      id: bobId,
      peers: [{ id: aliceId, actor: alice, presence: { typing: true } }]
    })
    expect(first.socket.last()).toEqual({ type: "join", peer: { id: bobId, actor: bob, presence: null } })

    second.socket.say({ type: "presence", presence: { typing: false } })
    await flush()
    expect(first.socket.last()).toEqual({ type: "presence", id: bobId, presence: { typing: false } })
    expect(await chat.connections("lobby")).toEqual([
      { id: aliceId, actor: alice, presence: { typing: true } },
      { id: bobId, actor: bob, presence: { typing: false } }
    ])

    second.socket.disconnect()
    await flush()
    expect(first.socket.last()).toEqual({ type: "leave", id: bobId })
    expect(await chat.connections("lobby")).toHaveLength(1)
  })

  it("keeps instances apart by key", async () => {
    const chat = defineRoom("chat")
    const lobby = await join(chat, "lobby", alice)
    await join(chat, "other", bob)

    expect(lobby.socket.frames).toHaveLength(1)
    expect(await chat.connections("other")).toHaveLength(1)
    expect(await chat.connections("empty")).toEqual([])
  })

  it("runs the room's hooks where it lives", async () => {
    const events: string[] = []
    const chat = defineRoom<{ text: string }>("chat", {
      onJoin(room, connection) {
        events.push(`join ${connection.actor?.userId} ${room.name}/${room.key}`)
        connection.send({ hello: connection.actor?.userId })
      },
      onMessage(room, connection, message) {
        room.broadcast({ from: connection.actor?.userId, text: message.text }, { except: connection })
        events.push(`peers ${room.connections().length}`)
      },
      onLeave(_room, connection) {
        events.push(`leave ${connection.actor?.userId}`)
      }
    })
    const first = await join(chat, "lobby", alice)
    const second = await join(chat, "lobby", bob)

    expect(second.socket.last()).toEqual({ type: "message", message: { hello: "bob" } })

    second.socket.say({ type: "message", message: { text: "hi" } })
    await flush()
    expect(first.socket.last()).toEqual({ type: "message", message: { from: "bob", text: "hi" } })
    expect(second.socket.last()).toEqual({ type: "message", message: { hello: "bob" } })

    first.socket.disconnect()
    await flush()
    expect(events).toEqual(["join alice chat/lobby", "join bob chat/lobby", "peers 2", "leave alice"])
  })

  it("lets hooks close connections", async () => {
    const chat = defineRoom("chat", { onMessage: (_room, connection) => connection.close(4000, "Bye") })
    const { socket } = await join(chat, "lobby", alice)

    socket.say({ type: "message", message: "anything" })
    await flush()

    expect(socket.closedWith).toEqual({ code: 4000, reason: "Bye" })
    expect(await chat.connections("lobby")).toEqual([])
  })

  it("drops client messages without onMessage", async () => {
    const chat = defineRoom("chat")
    const first = await join(chat, "lobby", alice)
    const second = await join(chat, "lobby", bob)

    second.socket.say({ type: "message", message: "ignored" })
    await flush()

    expect(first.socket.frames.map((frame) => (frame as { type: string }).type)).toEqual(["welcome", "join"])
  })

  it("checks messages and presence against the room's schemas", async () => {
    const onMessage = vi.fn<(room: unknown, connection: unknown, message: string) => void>()
    const chat = defineRoom("chat", {
      message: schema((value): value is string => typeof value === "string", "Messages are text"),
      presence: schema((value): value is { x: number } => typeof (value as { x?: unknown })?.x === "number", "Need x"),
      onMessage
    })
    const { socket } = await join(chat, "lobby", alice)

    socket.say({ type: "message", message: 42 })
    socket.say({ type: "presence", presence: { x: "left" } })
    await flush()

    expect(socket.frames.slice(1)).toEqual([
      { type: "error", code: "INVALID_MESSAGE", message: "Messages are text" },
      { type: "error", code: "INVALID_PRESENCE", message: "Need x" }
    ])
    expect(onMessage).not.toHaveBeenCalled()

    socket.say({ type: "message", message: "ok" })
    await flush()
    expect(onMessage).toHaveBeenCalledWith(expect.anything(), expect.anything(), "ok")
  })

  it("refuses presence over 1 KiB and frames it doesn't know", async () => {
    const { socket } = await join(defineRoom("chat"), "lobby", alice)

    socket.say({ type: "presence", presence: "x".repeat(1100) })
    socket.say("not json")
    socket.say({ type: "shout" })
    socket.say("ping")
    socket.say(new TextEncoder().encode(JSON.stringify({ type: "presence", presence: 1 })).buffer)
    await flush()

    expect(socket.frames.slice(1)).toEqual([
      expect.objectContaining({ type: "error", code: "PRESENCE_TOO_LARGE" }),
      expect.objectContaining({ type: "error", code: "INVALID_FRAME" }),
      expect.objectContaining({ type: "error", code: "INVALID_FRAME" }),
      "pong"
    ])
  })

  it("reports a hook that throws to the connection without its details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const chat = defineRoom("chat", {
      onMessage() {
        throw new Error("secret")
      },
      onLeave() {
        throw new Error("on leave")
      }
    })
    const { socket } = await join(chat, "lobby", alice)

    socket.say({ type: "message", message: 1 })
    await flush()
    socket.disconnect()
    await flush()

    expect(socket.last()).toEqual({ type: "error", code: "INTERNAL_ERROR", message: "The room couldn't handle that." })
    expect(consoleError).toHaveBeenCalledTimes(2)
  })

  it("broadcasts from server code to everyone but the excluded", async () => {
    const chat = defineRoom("chat")
    const first = await join(chat, "lobby", alice)
    const second = await join(chat, "lobby", bob)
    const bobId = (second.socket.frames[0] as { id: string }).id

    await chat.broadcast("lobby", { type: "comment.added" })
    await chat.broadcast("lobby", "only alice", { except: bobId })
    await chat.broadcast("lobby", "nobody", { except: [bobId, (first.socket.frames[0] as { id: string }).id] })
    await chat.broadcast("empty", "no one is here")

    expect(first.socket.frames.slice(-2)).toEqual([
      { type: "message", message: { type: "comment.added" } },
      { type: "message", message: "only alice" }
    ])
    expect(second.socket.last()).toEqual({ type: "message", message: { type: "comment.added" } })
  })

  it("waits for a connecting socket to open before welcoming it", async () => {
    const chat = defineRoom("chat")
    const socket = new FakeSocket()
    socket.readyState = 0
    nextSocket = socket

    await chat.connect(upgradeRequest(), { key: "lobby", actor: alice })
    await flush()
    expect(socket.frames).toEqual([])

    socket.readyState = 1
    socket.emit("open", { data: undefined })
    await flush()
    expect(socket.frames).toEqual([expect.objectContaining({ type: "welcome" })])
  })

  it("needs an upgrade function on runtimes without WebSocketPair", async () => {
    configureBackends({ realtime: { adapter: localRealtime() } })

    await expect(defineRoom("chat").connect(upgradeRequest(), { key: "lobby", actor: null })).rejects.toThrow(
      /upgrade function/
    )
  })
})

describe("connect", () => {
  it("answers requests that aren't WebSocket upgrades with 426", async () => {
    const response = await defineRoom("chat").connect(new Request("https://app.test/"), { key: "a", actor: alice })

    expect(response.status).toBe(426)
  })

  it("runs the join check before upgrading", async () => {
    const canJoin = vi.fn<(args: { actor: Actor | null; key: string }) => boolean>(
      ({ actor, key }: { actor: Actor | null; key: string }) => actor !== null && key !== "secret"
    )
    const chat = defineRoom("chat", { canJoin })

    expect((await join(chat, "secret", alice)).response.status).toBe(403)
    expect((await join(chat, "lobby", null)).response.status).toBe(403)
    expect((await join(chat, "lobby", alice)).response.status).toBe(200)
    expect(canJoin).toHaveBeenCalledWith(expect.objectContaining({ actor: alice, key: "lobby" }))
    expect(await chat.connections("lobby")).toHaveLength(1)
  })

  it("refuses keys that are empty or too long", async () => {
    const chat = defineRoom("chat")

    expect((await chat.connect(upgradeRequest(), { key: "", actor: alice })).status).toBe(404)
    await expect(chat.broadcast("k".repeat(513), "x")).rejects.toThrow(/Room keys/)
    await expect(chat.connections("")).rejects.toThrow(/Room keys/)
  })
})

describe("handleRooms", () => {
  it("accepts same-origin and explicitly allowed browser origins", async () => {
    for (const origin of ["https://app.test", "https://admin.test"]) {
      const room = defineRoom("origin")
      nextSocket = new FakeSocket()
      const response = await handleRooms(
        new Request("https://app.test/api/rooms/origin/key", {
          headers: { origin, upgrade: "websocket" }
        }),
        { rooms: [room], getActor: () => alice, allowedOrigins: origin === "https://admin.test" ? [origin] : undefined }
      )
      expect(response?.status).toBe(200)
      await flush()
    }
  })
  const chat = defineRoom("chat")
  const getActor = (request: Request): Actor | null => {
    const user = new URL(request.url).searchParams.get("user")
    return user ? { userId: user, orgId: null, roles: [] } : null
  }

  it("ignores requests outside its base path", async () => {
    expect(await handleRooms(new Request("https://app.test/api/apps/x"), { rooms: [chat], getActor })).toBeNull()
  })

  it("answers unknown rooms, missing keys and other methods", async () => {
    const send = (path: string, init?: RequestInit) =>
      handleRooms(new Request(`https://app.test${path}`, init), { rooms: [chat], getActor })

    expect((await send("/api/rooms/other/1"))?.status).toBe(404)
    expect((await send("/api/rooms/chat"))?.status).toBe(404)
    expect((await send("/api/rooms/chat/%E0%A4%A"))?.status).toBe(404)
    expect((await send("/api/rooms/chat/1", { method: "POST" }))?.status).toBe(405)
  })

  it("connects the actor to the room named in the path", async () => {
    nextSocket = new FakeSocket()
    const response = await handleRooms(
      new Request("https://app.test/live/chat/invoice%2F42?user=carol", { headers: { upgrade: "websocket" } }),
      { rooms: [chat], getActor, basePath: "/live/" }
    )
    await flush()

    expect(await response?.text()).toBe("upgraded")
    expect(await chat.connections("invoice/42")).toEqual([
      expect.objectContaining({ actor: { userId: "carol", orgId: null, roles: [] } })
    ])
  })
})

describe("the default Durable Object adapter", () => {
  it("names the binding a room is missing", async () => {
    configureBackends({ realtime: undefined })

    await expect(defineRoom("live-cursors").connections("a")).rejects.toThrow(/REALTIME_LIVE_CURSORS.*LiveCursorsRoom/)
  })

  it("derives binding and class names from room names", () => {
    expect(realtimeBindingName("invoice")).toBe("REALTIME_INVOICE")
    expect(roomClassName("invoice")).toBe("InvoiceRoom")
    expect(roomClassName("live-cursors")).toBe("LiveCursorsRoom")
  })
})

describe("defineRoom", () => {
  it("refuses names that can't become bindings", () => {
    expect(() => defineRoom("Chat")).toThrow(/lowercase/)
    expect(() => defineRoom("chat_room")).toThrow(/lowercase/)
  })
})

it("rejects foreign browser origins before resolving identity", async () => {
  const room = defineRoom("origin")
  const getActor = vi.fn<() => null>(() => null)
  const response = await handleRooms(
    new Request("https://app.test/api/rooms/origin/key", {
      headers: { origin: "https://attacker.test", upgrade: "websocket" }
    }),
    { rooms: [room], getActor }
  )
  expect(response?.status).toBe(403)
  expect(getActor).not.toHaveBeenCalled()
})
