import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { joinRoom } from "./client.js"

/** A browser WebSocket the test drives from the server's side. */
class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static sockets: FakeWebSocket[] = []

  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  closedWith: { code?: number | undefined; reason?: string | undefined } | undefined

  constructor(readonly url: string) {
    super()
    FakeWebSocket.sockets.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason }
    this.drop()
  }

  /** The server accepts the connection and welcomes it. */
  welcome(id: string, peers: unknown[] = []): void {
    this.readyState = FakeWebSocket.OPEN
    this.dispatchEvent(new Event("open"))
    this.frame({ type: "welcome", id, peers })
  }

  frame(frame: unknown): void {
    const data = typeof frame === "string" ? frame : JSON.stringify(frame)
    this.dispatchEvent(new MessageEvent("message", { data }))
  }

  /** The connection drops. */
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.dispatchEvent(new Event("close"))
  }

  frames(): unknown[] {
    return this.sent.filter((data) => data !== "ping").map((data) => JSON.parse(data) as unknown)
  }
}

const Socket = FakeWebSocket as unknown as typeof WebSocket
const latest = () => FakeWebSocket.sockets.at(-1)!

beforeEach(() => {
  FakeWebSocket.sockets = []
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("joinRoom", () => {
  it("connects to the room's WebSocket URL", () => {
    joinRoom("https://app.test/api/rooms/chat/1", { WebSocket: Socket }).leave()
    joinRoom(new URL("http://app.test/api/rooms/chat/1"), { WebSocket: Socket }).leave()
    joinRoom("wss://rooms.test/chat/1", { WebSocket: Socket }).leave()

    expect(FakeWebSocket.sockets.map((socket) => socket.url)).toEqual([
      "wss://app.test/api/rooms/chat/1",
      "ws://app.test/api/rooms/chat/1",
      "wss://rooms.test/chat/1"
    ])
  })

  it("keeps the peers and their presence", () => {
    const room = joinRoom<unknown, unknown, { x: number }>("https://app.test/r", { WebSocket: Socket })
    const listener = vi.fn<() => void>()
    room.subscribe(listener)

    expect(room.getSnapshot()).toEqual({ status: "connecting", id: null, peers: [], presence: null })

    latest().welcome("me", [{ id: "a", actor: null, presence: null }])
    latest().frame({ type: "join", peer: { id: "b", actor: null, presence: null } })
    latest().frame({ type: "presence", id: "b", presence: { x: 1 } })
    latest().frame({ type: "leave", id: "a" })

    expect(room.getSnapshot()).toEqual({
      status: "open",
      id: "me",
      peers: [{ id: "b", actor: null, presence: { x: 1 } }],
      presence: null
    })
    expect(listener).toHaveBeenCalledTimes(4)
    room.leave()
  })

  it("shares presence on join, on change and after reconnecting", () => {
    const room = joinRoom<unknown, unknown, { x: number }>("https://app.test/r", {
      WebSocket: Socket,
      presence: { x: 0 }
    })
    room.setPresence({ x: 1 })
    expect(latest().frames()).toEqual([])

    latest().welcome("me")
    room.setPresence({ x: 2 })
    expect(latest().frames()).toEqual([
      { type: "presence", presence: { x: 1 } },
      { type: "presence", presence: { x: 2 } }
    ])

    latest().drop()
    vi.advanceTimersByTime(1000)
    latest().welcome("me-again")
    expect(latest().frames()).toEqual([{ type: "presence", presence: { x: 2 } }])
    room.leave()
  })

  it("sends messages only while open, and passes on what the room sends", () => {
    const onMessage = vi.fn<(message: string) => void>()
    const onError = vi.fn<(error: { code: string; message: string }) => void>()
    const room = joinRoom<string, string>("https://app.test/r", { WebSocket: Socket, onMessage, onError })

    expect(room.send("too early")).toBe(false)
    latest().welcome("me")
    expect(room.send("hello")).toBe(true)
    latest().frame({ type: "message", message: "hi back" })
    latest().frame({ type: "error", code: "INVALID_MESSAGE", message: "No" })
    latest().frame("pong")
    latest().frame("not json")

    expect(latest().frames()).toEqual([{ type: "message", message: "hello" }])
    expect(onMessage).toHaveBeenCalledWith("hi back")
    expect(onError).toHaveBeenCalledWith({ code: "INVALID_MESSAGE", message: "No" })
    room.leave()
  })

  it("reconnects with growing delays until it's welcomed again", () => {
    vi.spyOn(Math, "random").mockReturnValue(1)
    const room = joinRoom("https://app.test/r", { WebSocket: Socket })
    latest().welcome("me", [{ id: "a", actor: null, presence: null }])

    latest().drop()
    expect(room.getSnapshot()).toMatchObject({ status: "connecting", id: null, peers: [] })
    vi.advanceTimersByTime(499)
    expect(FakeWebSocket.sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.sockets).toHaveLength(2)

    latest().drop()
    vi.advanceTimersByTime(999)
    expect(FakeWebSocket.sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.sockets).toHaveLength(3)

    latest().welcome("me-again")
    latest().drop()
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.sockets).toHaveLength(4)
    room.leave()
  })

  it("pings to keep the connection open", () => {
    const room = joinRoom("https://app.test/r", { WebSocket: Socket, pingInterval: 1000 })
    vi.advanceTimersByTime(1000)
    expect(latest().sent).toEqual([])

    latest().welcome("me")
    vi.advanceTimersByTime(1000)
    expect(latest().sent).toEqual(["ping"])
    room.leave()

    joinRoom("https://app.test/r", { WebSocket: Socket, pingInterval: 0 }).leave()
  })

  it("stops for good on leave", () => {
    const room = joinRoom("https://app.test/r", { WebSocket: Socket })
    const socket = latest()
    socket.welcome("me")

    room.leave()

    expect(socket.closedWith).toEqual({ code: 1000, reason: "Left the room" })
    expect(room.getSnapshot().status).toBe("closed")
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.sockets).toHaveLength(1)
  })

  it("ignores a replaced socket's late close", () => {
    const room = joinRoom("https://app.test/r", { WebSocket: Socket })
    const first = latest()
    first.drop()
    vi.advanceTimersByTime(1000)
    latest().welcome("me")

    first.drop()

    expect(room.getSnapshot().status).toBe("open")
    room.leave()
  })
})
