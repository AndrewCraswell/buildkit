// The Durable Object class in Node, with fake hibernating sockets, for what src/workerd.test.ts can't reach: the
// paths after hibernation and the attachment limit. Node can't build a 101 response, so upgrades answer 200 here.
import { configureBackends, type Actor } from "better-apps"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { durableObjectRealtime, roomDurableObject, type RoomDurableObject } from "./cloudflare.js"
import { defineRoom, type ServerFrame } from "./index.js"

/** A Workers WebSocket with an attachment that holds 2 KiB, as hibernation does. */
class FakeSocket {
  attachment: unknown = null
  frames: (ServerFrame | string)[] = []
  closed: { code?: number | undefined; reason?: string | undefined } | undefined

  send(data: string): void {
    if (this.closed) {
      throw new Error("WebSocket is closed")
    }
    this.frames.push(data === "pong" ? data : (JSON.parse(data) as ServerFrame))
  }

  close(code?: number, reason?: string): void {
    if (this.closed) {
      throw new Error("Already closed")
    }
    this.closed = { code, reason }
  }

  serializeAttachment(value: unknown): void {
    if (JSON.stringify(value).length > 2048) {
      throw new Error("Attachment too large")
    }
    this.attachment = structuredClone(value)
  }

  deserializeAttachment(): unknown {
    return structuredClone(this.attachment)
  }
}

class FakeState {
  sockets: FakeSocket[] = []
  autoResponse: unknown

  acceptWebSocket(socket: FakeSocket): void {
    this.sockets.push(socket)
  }

  getWebSockets(): FakeSocket[] {
    return this.sockets
  }

  setWebSocketAutoResponse(pair: unknown): void {
    this.autoResponse = pair
  }
}

const NodeResponse = Response
const alice: Actor = { userId: "alice", orgId: null, roles: [] }

beforeAll(() => {
  vi.stubGlobal(
    "WebSocketPair",
    class {
      0 = new FakeSocket()
      1 = new FakeSocket()
    }
  )
  vi.stubGlobal(
    "WebSocketRequestResponsePair",
    class {
      constructor(
        readonly request: string,
        readonly response: string
      ) {}
    }
  )
  vi.stubGlobal(
    "Response",
    class extends NodeResponse {
      constructor(body?: BodyInit | null, init?: ResponseInit) {
        super(body, init?.status === 101 ? { ...init, status: 200 } : init)
      }
    }
  )
})

afterAll(() => vi.unstubAllGlobals())
afterEach(() => configureBackends({ realtime: undefined }))

function setUp(room = defineRoom("chat", { onMessage: (r, c, m) => r.broadcast(m, { except: c }) })) {
  const RoomObject = roomDurableObject(room)
  const state = new FakeState()
  const object: RoomDurableObject = new RoomObject(state as never, {} as never)
  const namespace = { idFromName: (key: string) => `id:${key}`, get: () => object }
  configureBackends({ realtime: { adapter: durableObjectRealtime({ namespaces: { [room.name]: namespace } }) } })
  return { room, state, object }
}

async function joinAs(room: ReturnType<typeof defineRoom>, state: FakeState, actor: Actor | null) {
  const response = await room.connect(
    new Request("https://app.test/api/rooms/chat/lobby", { headers: { upgrade: "websocket" } }),
    { key: "lobby", actor }
  )
  return { response, socket: state.sockets.at(-1)! }
}

describe("a room's Durable Object", () => {
  it("answers pings without waking", () => {
    const { state } = setUp()

    expect(state.autoResponse).toEqual({ request: "ping", response: "pong" })
  })

  it("accepts sockets with their state in the attachment", async () => {
    const { room, state } = setUp()

    const { response, socket } = await joinAs(room, state, alice)

    expect(response.status).toBe(200)
    expect(socket.attachment).toEqual({ id: expect.any(String), actor: alice, presence: null, key: "lobby" })
    expect(socket.frames).toEqual([{ type: "welcome", id: expect.any(String), peers: [] }])
    expect(await room.connections("lobby")).toEqual([{ id: expect.any(String), actor: alice, presence: null }])
  })

  it("handles frames and broadcasts from the state in each socket's attachment", async () => {
    const { room, state, object } = setUp()
    const first = await joinAs(room, state, alice)
    const second = await joinAs(room, state, null)

    await object.webSocketMessage(second.socket as never, JSON.stringify({ type: "presence", presence: { x: 1 } }))
    await object.webSocketMessage(second.socket as never, JSON.stringify({ type: "message", message: "hi" }))
    await room.broadcast("lobby", "from the server")

    expect(first.socket.frames.slice(1)).toEqual([
      { type: "join", peer: expect.objectContaining({ actor: null }) },
      { type: "presence", id: expect.any(String), presence: { x: 1 } },
      { type: "message", message: "hi" },
      { type: "message", message: "from the server" }
    ])
    expect(second.socket.attachment).toMatchObject({ presence: { x: 1 } })
  })

  it("tells the others when a socket closes or errors, and stops counting it", async () => {
    const { room, state, object } = setUp()
    const first = await joinAs(room, state, alice)
    const second = await joinAs(room, state, null)
    const third = await joinAs(room, state, null)
    const secondId = (second.socket.attachment as { id: string }).id
    const thirdId = (third.socket.attachment as { id: string }).id

    await object.webSocketClose(second.socket as never, 1001, "Gone", true)
    await object.webSocketError(third.socket as never, new Error("reset"))
    await object.webSocketClose(third.socket as never, 1006, "", false)

    expect(second.socket.closed).toEqual({ code: 1001, reason: "Gone" })
    expect(first.socket.frames.slice(-2)).toEqual([
      { type: "leave", id: secondId },
      { type: "leave", id: thirdId }
    ])
    expect(await room.connections("lobby")).toEqual([expect.objectContaining({ actor: alice })])
  })

  it("refuses presence that doesn't fit beside the actor", async () => {
    const { room, state, object } = setUp()
    const roles = Array.from({ length: 45 }, (_, index) => `role-with-a-long-name-${index}`)
    const { socket } = await joinAs(room, state, { userId: "big", orgId: null, roles })

    await object.webSocketMessage(socket as never, JSON.stringify({ type: "presence", presence: "x".repeat(900) }))

    expect(socket.frames.at(-1)).toEqual(expect.objectContaining({ code: "PRESENCE_TOO_LARGE" }))
  })

  it("refuses actors too large for an attachment, and requests that aren't upgrades", async () => {
    const { room, state, object } = setUp()
    const roles = Array.from({ length: 100 }, (_, index) => `role-with-a-long-name-${index}`)

    const { response } = await joinAs(room, state, { userId: "huge", orgId: null, roles })

    expect(response.status).toBe(400)
    expect(state.sockets).toEqual([])
    expect((await object.fetch(new Request("https://room.test/"))).status).toBe(426)
  })

  it("ignores events for sockets without state", async () => {
    const { object, state } = setUp()
    const stray = new FakeSocket()
    state.sockets.push(stray)

    await object.webSocketMessage(stray as never, "{}")
    await object.webSocketClose(stray as never, 1000, "", true)

    expect(stray.frames).toEqual([])
  })
})
