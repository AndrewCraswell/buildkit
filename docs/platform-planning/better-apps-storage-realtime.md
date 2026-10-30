# Better Apps storage and realtime

The design for the first two capability packages, `@better-apps/storage` and `@better-apps/realtime`, and for how an app
picks their adapters without the deploy service. It follows the declaration rules in
[better-apps-deploy.md](better-apps-deploy.md) §2 and answers its open question 8.3 (Durable Object classes).

**Status (2026-10-30):** agreed. Storage is being built first, then realtime.

## 1. Goals

- Apps store files and run rooms on Cloudflare today, without the deploy service.
- Features and app code use one cloud-neutral API. Nothing outside an adapter or a default names a cloud.
- The same wiring works whether the app or, later, the deploy service deploys it.

## 2. Packages

| Package                 | Entry point    | Contents                                                                                         |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `better-apps`           | `.`            | `configureBackends` and the `Backends` interface that capability packages extend                 |
| `@better-apps/storage`  | `.`            | `defineBucket`, `handleUpload` and the adapter interface                                         |
|                         | `./cloudflare` | `r2Storage`: R2 bindings, the default                                                            |
|                         | `./local`      | `memoryStorage` and `fileStorage` (Node's filesystem)                                            |
| `@better-apps/realtime` | `.`            | `defineRoom`, `handleRooms` and the adapter interface                                            |
|                         | `./cloudflare` | `durableObjectRealtime`, the default, and `roomDurableObject`: one Durable Object class per room |
|                         | `./local`      | `localRealtime`: an in-process room server                                                       |
|                         | `./client`     | `joinRoom`: a browser client with presence and reconnects, with no framework                     |

Both capability packages take `better-apps` as a peer dependency, for `configureBackends` and, in realtime, the `Actor`
type, so a room's join check can call `app.subjects.canView(actor, ...)`. Both are `sideEffects: false`, and
`defineBucket` and `defineRoom` are marked `/*#__NO_SIDE_EFFECTS__*/` (rule 5).

## 3. Storage

```ts
// src/server/storage.ts
import { defineBucket } from "@better-apps/storage"

export const avatars = defineBucket("avatars", { maxSize: 5_000_000, contentTypes: ["image/*"] })

await avatars.put(`users/${userId}.png`, body, { contentType: "image/png" })
const file = await avatars.get(key) // { key, size, etag, contentType, uploadedAt, metadata, body, text(), ... } or null
await avatars.head(key)
await avatars.delete([key1, key2])
const page = await avatars.list({ prefix: "users/", limit: 100, cursor }) // { objects, prefixes, cursor }
return avatars.serve(key, request) // a Response: 200 with type, length and ETag, 304 on a matching If-None-Match, or 404
```

- The name and the limits are literals (rule 3). `put` and uploads enforce `maxSize` and `contentTypes` (exact types or
  `type/*`).
- `metadata` is a string map; `contentType` and `cacheControl` are separate fields, as in R2 and S3.

**Uploads from the browser** go through the app ("direct" uploads), so they work on every adapter:

1. Server code calls `avatars.createUpload({ key, contentType, size })`. It checks the limits and returns
   `{ url, method: "PUT", headers, expiresAt }`. The URL carries a token signed with HMAC-SHA-256 that names the bucket,
   key, content type, size and expiry.
2. The browser sends the file to that URL.
3. `handleUpload(request)`, mounted at the upload URL, checks the token, the method, the `Content-Type` and the
   `Content-Length`, counts bytes as it streams the body into the bucket, and stops past the signed size. It answers
   `201` with the stored object, or `null` for requests outside the upload path, so it can sit in front of other
   handlers.

Presigned URLs straight to R2 need S3 API credentials, which a binding doesn't have. They can come later as an option of
`r2Storage`: when an adapter can presign, `createUpload` returns its URL instead, and callers don't change.

**Adapter interface:** `StorageAdapter.bucket(name)` returns `put`, `get`, `head`, `delete` and `list` for that bucket.
Limits, uploads and `serve` live in the neutral package, so adapters stay small.

## 4. Realtime

```ts
// src/server/rooms.ts
import { defineRoom } from "@better-apps/realtime"

export const invoiceRoom = defineRoom("invoice", {
  // Runs in the Worker before the upgrade. The key is the room instance, such as an invoice id.
  canJoin: ({ actor, key }) => app.subjects.canView(actor, { subjectType: "invoice", subjectId: key }),
  onMessage(room, connection, message) {
    room.broadcast({ from: connection.id, message }, { except: connection })
  }
})

// Server code, such as after a comment is added:
await invoiceRoom.broadcast(invoiceId, { type: "comment.added", commentId })
await invoiceRoom.connections(invoiceId) // [{ id, actor, presence }]
```

- **Rooms are keyed by name.** The declaration is a kind of room; `key` picks the instance (one room per subject).
- **Joining:** `invoiceRoom.connect(request, { key, actor })` runs `canJoin` and returns the WebSocket upgrade
  `Response`, or 403. `handleRooms(request, { rooms, getActor })` does it for the listed rooms at
  `GET /api/rooms/{room}/{key}`, reading the actor from the identity adapter
  (`getActor: (request) => identity.getActor(request)`). The list only routes URLs; apps that serve each room from their
  own route call `connect` and skip it.
- **Presence is built in.** Each connection has a JSON presence state the client sets. The server tells the others when
  someone joins, leaves or changes presence, and sends the current list on join. Presence is capped at 1 KiB, because it
  lives in the WebSocket's hibernation attachment.
- **Messages:** `onJoin`, `onMessage` and `onLeave` run where the room lives (the Durable Object on Cloudflare).
  `room.broadcast`, `connection.send`, `connection.close` and `room.connections()` are available there. Without
  `onMessage`, client messages are dropped.
- **Wire protocol** (JSON text frames): the server sends `welcome` (its own id and the others), `join`, `leave`,
  `presence` and `message`; the client sends `presence` and `message`. `@better-apps/realtime/client` speaks it and
  reconnects with backoff.

**Adapter interface:** `connect`, `broadcast` and `connections`, each given the room definition and key. The room logic
(presence, the protocol, the hooks) is one shared engine in the neutral package. Adapters only move frames: the Durable
Object maps hibernation events to it, and the local server maps in-memory sockets to it.

**Cloudflare:** each room has its own Durable Object class (§6). Each instance is `idFromName(key)` in the room's
namespace, and each socket is accepted with `ctx.acceptWebSocket`, so idle rooms hibernate. The connection's id, actor
and presence are in its attachment, so a woken object rebuilds its state from `ctx.getWebSockets()`. Broadcasts from
server code use RPC on the stub.

**Local:** `localRealtime()` keeps rooms in memory in the same process. It upgrades with `WebSocketPair` where the
runtime has it (workerd, Miniflare), or with an `upgrade(request)` function the app passes for Deno, Bun or a Node `ws`
server. Tests join rooms with in-memory sockets, with no network.

## 5. Choosing adapters

**Cloudflare is the default.** With no configuration, every capability uses its Cloudflare adapter, which reads `env`
from `cloudflare:workers` and finds bindings by names derived from the declaration:

| Declaration               | Binding                 | Kind                                      |
| ------------------------- | ----------------------- | ----------------------------------------- |
| `defineBucket("avatars")` | `STORAGE_AVATARS`       | R2 bucket                                 |
| `defineRoom("invoice")`   | `REALTIME_INVOICE`      | Durable Object namespace of `InvoiceRoom` |
| direct uploads            | `STORAGE_UPLOAD_SECRET` | Worker secret                             |

Names are upper-cased, with every character other than a letter or digit turned into `_`.

- On Cloudflare this works with no wiring module at all.
- Anywhere else, such as Node or a test, the first call fails with an error that names the missing binding and
  `configureBackends`. It never falls back to memory, which would lose files without a sign.

**`configureBackends` overrides any of them, in one place:**

```ts
// src/server/backends.ts, imported by the server entry
import { localRealtime } from "@better-apps/realtime/local"
import { memoryStorage } from "@better-apps/storage/local"
import { configureBackends } from "better-apps"

configureBackends({
  storage: { adapter: memoryStorage(), uploads: { url: "/api/storage/upload", secret: "dev-secret" } },
  realtime: { adapter: localRealtime() }
})
```

- Each capability package adds its key to core's `Backends` interface by declaration merging, so core imports neither
  package, and later capabilities (kv, queues) slot in the same way.
- A key left out keeps its Cloudflare default: `configureBackends({ storage: { adapter: s3Storage(...) } })` keeps rooms
  on Durable Objects.
- Apps on Cloudflare with their own binding names pass them: `r2Storage({ buckets: { avatars: env.MY_R2 } })`,
  `durableObjectRealtime({ namespaces: { invoice: env.ROOMS } })`.
- Handles resolve their adapter on first use, not at import, so declarations can live anywhere, inside feature packages
  too, as long as the server entry imports the wiring module.
- **The deploy service writes nothing here.** It deploys with the derived binding names, so the defaults find them. That
  replaces the `#adapter` export conditions in [better-apps-deploy.md](better-apps-deploy.md) §4.

**Rejected:**

- **Adapters on `createBetterApps`.** Handles are module-level values and can't reach the app object, and storage and
  rooms are useful without Better Apps features.
- **An adapter per declaration** (`defineBucket("avatars", { adapter })`): it breaks rule 3 and scatters the choice.
- **A local default:** on Cloudflare it would write files to memory and lose them.

## 6. Durable Object classes in the Worker entry (open question 8.3)

Cloudflare needs each Durable Object class as a named export of the Worker's main module. Each room gets its own class,
built from its declaration:

```ts
import { presenceRoom } from "@better-apps/presence"
// src/server.ts: the Worker entry
import { handleRooms } from "@better-apps/realtime"
import { roomDurableObject } from "@better-apps/realtime/cloudflare"
import handler from "@tanstack/react-start/server-entry"
import { invoiceRoom } from "./server/rooms"

export const InvoiceRoom = roomDurableObject(invoiceRoom)
export const PresenceRoom = roomDurableObject(presenceRoom)

const rooms = [invoiceRoom, presenceRoom]

export default {
  async fetch(request, env, ctx) {
    // Upgrades are answered before Start, which could copy the Response and drop its WebSocket.
    return (await handleRooms(request, { rooms, getActor })) ?? handler.fetch(request, env, ctx)
  }
}
```

```jsonc
// wrangler.jsonc, kept by an app that deploys itself (the deploy service renders this instead)
{
  "durable_objects": {
    "bindings": [
      { "name": "REALTIME_INVOICE", "class_name": "InvoiceRoom" },
      { "name": "REALTIME_PRESENCE", "class_name": "PresenceRoom" }
    ]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["InvoiceRoom", "PresenceRoom"] }],
  "r2_buckets": [{ "binding": "STORAGE_AVATARS", "bucket_name": "my-app-avatars" }]
}
```

- **A class per room needs no registry.** The class closes over its own declaration, so a woken Durable Object already
  has the room's hooks, with no lookup by name and no list that lazily loaded modules could miss.
- **It matches the deploy plan:** one manifest row, class, binding and migration entry per room. A rename shows as a
  delete plus a create (rule 8), and the migration journal in the deploy doc works as written.
- **Rooms are isolated:** each has its own namespace in Cloudflare's dashboard, its own location settings and, once
  rooms keep durable state, its own data to delete.
- **The cost** falls on apps that keep their own `wrangler.jsonc`: an export, a binding and a migration entry per room.
  A missing one fails the deploy rather than failing quietly.
- **With the deploy service,** the build plugin knows every room that reaches the bundle (deploy doc §3), so it
  generates the exports, bindings and migrations. The app writes none of them.

## 7. Testing

- Unit tests run on the local adapters.
- The Cloudflare adapters run against real R2 and Durable Objects in Miniflare, which the repo already uses for D1 tests
  in `@better-apps/drizzle`.

## 8. Build order

1. `configureBackends` in `better-apps`, and `@better-apps/storage`: the neutral API, local adapters, the R2 adapter and
   direct uploads.
2. `@better-apps/realtime`: the room engine, the local server, the Durable Object adapter and the client.
