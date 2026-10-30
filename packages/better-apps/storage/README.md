# @better-apps/storage

Object storage for apps and [Better Apps](../better-apps/README.md) features. Declare a bucket in code, then store,
read, list and serve files through it, and take uploads from the browser with size and type limits. It runs on
Cloudflare R2 by default, and on memory or the filesystem for tests and local development. Any other provider can plug
in through the adapter interface.

## Usage

```ts
// src/server/storage.ts
import { defineBucket } from "@better-apps/storage"

export const avatars = defineBucket("avatars", { maxSize: 5_000_000, contentTypes: ["image/*"] })
```

```ts
await avatars.put(`users/${userId}.png`, body, { contentType: "image/png", metadata: { userId } })

const file = await avatars.get(key) // null when missing
await file?.text()

await avatars.head(key) // size, etag, contentType, cacheControl, metadata, uploadedAt
await avatars.delete([key, otherKey])
const { objects, prefixes, cursor } = await avatars.list({ prefix: "users/", delimiter: "/", limit: 100 })

return avatars.serve(key, request) // 200, 304 or 404
```

Declare buckets at module top level with a literal name, and export the handle: the name is the bucket's identity, and
the deploy service finds buckets by reading the code. Bucket names use lowercase letters, digits and hyphens.

- `put` takes a string, bytes, a `Blob` or a stream. Pass a stream's `size` when you know it; R2 needs it to stream the
  body instead of reading it into memory.
- `maxSize` and `contentTypes` apply to `put` and uploads. Content types match exactly or as `type/*`, ignoring
  parameters such as `charset`. A refused object throws a `BetterAppsError`: `LIMIT_EXCEEDED` (413) or
  `UNSUPPORTED_MEDIA_TYPE` (415), which actions return to the client as they are.
- `list` returns up to 1000 objects in key order, with a `cursor` for the next page. With a `delimiter`, keys are
  grouped into `prefixes` like folders.
- `serve` sends the object with its type, length, ETag and `Cache-Control`, answers a matching `If-None-Match` with 304,
  and `HEAD` without a body. It always sends `X-Content-Type-Options: nosniff` and a sandboxing Content Security Policy,
  so an uploaded HTML or SVG file can't run scripts as your app. `download` sends it as an attachment.

## Uploads from the browser

The browser sends files to your app at a URL your server signed, and your app streams them into the bucket:

```ts
// A server function or action: check who may upload, then sign a URL for one file.
const upload = await avatars.createUpload({ key: `users/${userId}.png`, contentType: file.type, size: file.size })
return upload // { url, method: "PUT", headers, expiresAt }
```

```ts
// In the browser:
await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file })
```

```ts
// The server entry, before the app's own handler:
import { handleUpload } from "@better-apps/storage"

export default {
  async fetch(request, env, ctx) {
    return (await handleUpload(request)) ?? handler.fetch(request, env, ctx)
  }
}
```

- `createUpload` checks the bucket's limits and signs the bucket, key, content type and size into the URL with
  HMAC-SHA-256. It expires after 15 minutes unless you pass `expiresIn` in seconds.
- `handleUpload` answers at `/api/storage/upload` and returns `null` for other requests. It checks the signature,
  expiry, `Content-Type` and `Content-Length`, stops a body that runs past the signed size, and answers `201` with the
  stored object.
- The URL and the signing secret come from `configureBackends({ storage: { uploads: { url, secret } } })`. The secret
  defaults to the Worker secret `STORAGE_UPLOAD_SECRET`.

## Adapters

Buckets use R2 unless the app chooses another adapter with `configureBackends` from `better-apps`, once, in a server
module its server entry imports:

```ts
import { fileStorage, memoryStorage } from "@better-apps/storage/local"
import { configureBackends } from "better-apps"

configureBackends({ storage: { adapter: memoryStorage(), uploads: { secret: "test-secret" } } })
// or, for local development without Cloudflare's runtime:
configureBackends({ storage: { adapter: fileStorage({ directory: ".better-apps/storage" }) } })
```

- **`r2Storage()`** from `@better-apps/storage/cloudflare`, the default, reads each bucket's binding from
  `cloudflare:workers`: `STORAGE_` and the name, upper-cased with other characters as `_`, so `user-files` reads
  `STORAGE_USER_FILES`. Pass other bindings with `r2Storage({ buckets: { avatars: env.MY_BUCKET } })`. Off Cloudflare,
  the first call fails with a message that points to `configureBackends`.
- **`memoryStorage()`** keeps objects in memory, for tests.
- **`fileStorage({ directory })`** keeps them in a folder on Node's filesystem, one folder per bucket.
- **Another provider** implements `StorageAdapter`: `bucket(name)` returns `put`, `get`, `head`, `delete` and `list`.
  Buckets check keys and limits before calling it, and build uploads and `serve` on top.

## Deploying to Cloudflare

Without Better Apps' deploy service, bind each bucket in the app's Wrangler config:

```jsonc
{
  "r2_buckets": [{ "binding": "STORAGE_AVATARS", "bucket_name": "my-app-avatars" }]
}
```

Create the bucket once with `wrangler r2 bucket create my-app-avatars`, and set the upload secret with
`wrangler secret put STORAGE_UPLOAD_SECRET`.
