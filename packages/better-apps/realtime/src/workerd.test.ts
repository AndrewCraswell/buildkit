// Runs a room on a real Durable Object in Miniflare, with WebSocket hibernation, and joins it with the browser client
// over a real socket. Tests run before the package builds, so the package's source loads with its types stripped.
import { readFileSync } from "node:fs"
import { stripTypeScriptTypes } from "node:module"
import { Miniflare } from "miniflare"
import { afterAll, describe, expect, it, vi } from "vite-plus/test"
import { joinRoom, type RoomConnection } from "./client.js"
import type { Peer } from "./protocol.js"

function compile(file: string): string {
  return stripTypeScriptTypes(readFileSync(new URL(file, import.meta.url), "utf8"))
}

const worker = `
import { roomDurableObject } from "./cloudflare.js"
import { handleRooms } from "./handler.js"
import { defineRoom } from "./room.js"

const chat = defineRoom("chat", {
  canJoin: ({ actor }) => actor !== null,
  onMessage(room, connection, message) {
    room.broadcast({ from: connection.actor.userId, text: message.text }, { except: connection })
  }
})

export const ChatRoom = roomDurableObject(chat)

function getActor(request) {
  const user = new URL(request.url).searchParams.get("user")
  return user ? { userId: user, orgId: null, roles: [] } : null
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/notify") {
      await chat.broadcast("lobby", { text: "from the server" })
      return Response.json(await chat.connections("lobby"))
    }
    return (await handleRooms(request, { rooms: [chat], getActor })) ?? new Response("the app")
  }
}
`

const miniflare = new Miniflare({
  compatibilityDate: "2026-07-01",
  modules: [
    { type: "ESModule", path: "worker.js", contents: worker },
    ...["cloudflare", "engine", "protocol", "room", "backends", "handler"].map((name) => ({
      type: "ESModule" as const,
      path: `${name}.js`,
      contents: compile(`./${name}.ts`)
    })),
    // The room code reads configureBackends' choice; with none, rooms use their Durable Object bindings.
    { type: "ESModule", path: "better-apps", contents: "export function getBackend() { return undefined }" }
  ],
  durableObjects: { REALTIME_CHAT: "ChatRoom" }
})

const connections: RoomConnection<{ text: string }, { typing: boolean }>[] = []

afterAll(async () => {
  for (const connection of connections) {
    connection.leave()
  }
  await miniflare.dispose()
})

async function open(user: string, received: unknown[] = []) {
  const url = new URL(`/api/rooms/chat/lobby?user=${user}`, await miniflare.ready)
  const connection = joinRoom<unknown, { text: string }, { typing: boolean }>(url, {
    presence: { typing: false },
    onMessage: (message) => received.push(message)
  })
  connections.push(connection)
  await vi.waitFor(() => expect(connection.getSnapshot().status).toBe("open"), { timeout: 10_000 })
  return connection
}

function users(peers: readonly Peer[]): (string | undefined)[] {
  return peers.map((peer) => peer.actor?.userId)
}

// Starting workerd can take a few seconds on a cold machine.
describe("a room on a Durable Object", { timeout: 30_000 }, () => {
  it("shares presence, messages and server broadcasts between clients", async () => {
    const aliceMessages: unknown[] = []
    const bobMessages: unknown[] = []
    const alice = await open("alice", aliceMessages)
    const bob = await open("bob", bobMessages)

    expect(users(bob.getSnapshot().peers)).toEqual(["alice"])
    await vi.waitFor(() => expect(users(alice.getSnapshot().peers)).toEqual(["bob"]))

    bob.setPresence({ typing: true })
    await vi.waitFor(() => expect(alice.getSnapshot().peers[0]?.presence).toEqual({ typing: true }))

    expect(bob.send({ text: "hi" })).toBe(true)
    await vi.waitFor(() => expect(aliceMessages).toEqual([{ from: "bob", text: "hi" }]))

    const notify = await miniflare.dispatchFetch("http://worker.test/notify")
    const peers = (await notify.json()) as Peer[]
    expect(users(peers).sort()).toEqual(["alice", "bob"])
    await vi.waitFor(() => expect(bobMessages).toEqual([{ text: "from the server" }]))
    expect(aliceMessages).toEqual([{ from: "bob", text: "hi" }, { text: "from the server" }])

    bob.leave()
    await vi.waitFor(() => expect(alice.getSnapshot().peers).toEqual([]))
    expect(bob.getSnapshot().status).toBe("closed")
  })

  it("refuses visitors the join check turns away", async () => {
    const url = new URL("/api/rooms/chat/lobby", await miniflare.ready)
    url.protocol = "ws:"
    const socket = new WebSocket(url)
    const closed = new Promise<void>((resolve) => socket.addEventListener("close", () => resolve()))
    const opened = vi.fn<() => void>()
    socket.addEventListener("open", opened)

    await closed

    expect(opened).not.toHaveBeenCalled()
    const response = await miniflare.dispatchFetch("http://worker.test/api/rooms/chat/lobby", {
      headers: { upgrade: "websocket" }
    })
    expect(response.status).toBe(403)
  })

  it("leaves other requests to the app", async () => {
    const response = await miniflare.dispatchFetch("http://worker.test/")

    expect(await response.text()).toBe("the app")
  })
})
