# @better-apps/realtime

Real-time rooms for apps and [Better Apps](../better-apps/README.md) features: who's here, what they're doing, and live
updates, such as one room per invoice that shows who's viewing it and refreshes when a comment is added. Declare a room
in code, check who may join, and broadcast to it from server code. It runs on Cloudflare Durable Objects by default,
with WebSocket hibernation, and in process for tests and local development.

## Usage

```ts
// src/server/rooms.ts
import { defineRoom } from "@better-apps/realtime"

export const invoiceRoom = defineRoom("invoice", {
  // Runs before the WebSocket opens. The key is the room instance, here an invoice id.
  canJoin: ({ actor, key }) => app.subjects.canView(actor, { subjectType: "invoice", subjectId: key }),
  onMessage(room, connection, message) {
    room.broadcast({ from: connection.id, message }, { except: connection })
  }
})
```

```ts
// Server code, such as after a comment is added:
await invoiceRoom.broadcast(invoiceId, { type: "comment.added", commentId })
await invoiceRoom.connections(invoiceId) // [{ id, actor, presence }]
```

```ts
// In the browser:
import { joinRoom } from "@better-apps/realtime/client"

const room = joinRoom<ServerMessage, ClientMessage, { field: string | null }>(
  `/api/rooms/invoice/${encodeURIComponent(invoiceId)}`,
  {
    presence: { field: null },
    onMessage: (message) => refresh(message)
  }
)
room.setPresence({ field: "amount" })
room.subscribe(() => render(room.getSnapshot())) // { status, id, peers, presence }
// In your component or page cleanup handler:
const cleanup = () => room.leave()
```

Declare rooms at module top level with a literal name, and export the handle: the name is the room's identity, and the
deploy service finds rooms by reading the code. Room names start with a lowercase letter, contain only lowercase
letters, digits and hyphens, and are at most 63 characters long.

- **Keys are instances.** `invoiceRoom` is a kind of room; each key, such as an invoice id, is its own room.
- **`canJoin`** decides who may join an instance. Without it, anyone who reaches the URL joins, so rooms about an app's
  records should check access, as above. `null` as the actor is a signed-out visitor.
- **Presence is built in.** Each connection shares a JSON value, at most 1 KiB, such as the field someone is editing.
  Everyone sees who joins and leaves and what they share.
- **Hooks** `onJoin`, `onMessage` and `onLeave` run where the room lives, with `room.broadcast`, `room.connections()`,
  `connection.send` and `connection.close`. Without `onMessage`, client messages are dropped.
- **Schemas:** `message` and `presence` take any Standard Schema, such as a zod schema, and check what clients send
  before the room sees it. Refused frames come back to the client as errors (`onError`).
- **Broadcasts from server code** reach everyone in an instance, or everyone but the connection ids in `except`.
- **The client** keeps the peers and their presence, re-shares presence after a reconnect, reconnects with backoff, and
  pings every 30 seconds. Its snapshot works with React's `useSyncExternalStore`.

## Serving rooms

`handleRooms` answers WebSocket upgrades at `GET /api/rooms/{room}/{key}` for the rooms you list, reading the actor from
your identity adapter. Call it in the Worker entry, before frameworks such as TanStack Start, which could copy the
response and lose its WebSocket:

```ts
// src/server.ts: the Worker entry
import { handleRooms } from "@better-apps/realtime"
import { roomDurableObject } from "@better-apps/realtime/cloudflare"
import handler from "@tanstack/react-start/server-entry"
import { identity } from "./server/app"
import { invoiceRoom } from "./server/rooms"

export const InvoiceRoom = roomDurableObject(invoiceRoom)

const rooms = [invoiceRoom]

export default {
  async fetch(request, env, ctx) {
    return (
      (await handleRooms(request, { rooms, getActor: (request) => identity.getActor(request) })) ??
      handler.fetch(request, env, ctx)
    )
  }
}
```

It returns `null` for other paths, 404 for rooms it doesn't serve, 426 for requests that aren't upgrades and 403 when
`canJoin` refuses. Apps that route rooms themselves call `invoiceRoom.connect(request, { key, actor })` instead.

## Adapters

Rooms use Durable Objects unless the app chooses another adapter with `configureBackends` from `better-apps`, once, in a
server module its server entry imports:

```ts
import { localRealtime } from "@better-apps/realtime/local"
import { configureBackends } from "better-apps"

configureBackends({ realtime: { adapter: localRealtime() } })
```

- **`durableObjectRealtime()`** from `@better-apps/realtime/cloudflare`, the default, runs each room in its own Durable
  Object class, one object per key. It reads each room's namespace from `cloudflare:workers`: `REALTIME_` and the name,
  upper-cased with other characters as `_`. Pass other bindings with
  `durableObjectRealtime({ namespaces: { invoice: env.ROOMS } })`. Sockets hibernate when the room is idle, and keep
  each connection's actor and presence in their attachment, so a woken room carries on.
- **`roomDurableObject(room)`** builds a room's class. Export it from the Worker entry; by convention its name is the
  room's name in PascalCase plus `Room`, so `invoice` is `InvoiceRoom` and `live-cursors` is `LiveCursorsRoom`.
- **`localRealtime()`** runs rooms in memory in the same process. It upgrades with `WebSocketPair` in workerd and
  Miniflare; elsewhere, pass `upgrade`, which returns `{ socket, response }`, such as
  `localRealtime({ upgrade: (request) => Deno.upgradeWebSocket(request) })`.
- **Another backend** implements `RealtimeAdapter`: `connect`, `broadcast` and `connections`.

## Deploying to Cloudflare

Without Better Apps' deploy service, bind each room's class in the app's Wrangler config, and add it to a migration
once:

```jsonc
{
  "durable_objects": { "bindings": [{ "name": "REALTIME_INVOICE", "class_name": "InvoiceRoom" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["InvoiceRoom"] }]
}
```

A new room adds a binding and a migration entry with a new tag. A removed room needs a `deleted_classes` migration.

Browser joins default to the same origin. Set `allowedOrigins` on `handleRooms` when serving a separate frontend or
using a proxy that rewrites the host. Requests without an Origin header are allowed for server clients.
