# @better-apps/tanstack-start

Runs a [Better Apps](../better-apps/README.md) app in [TanStack Start](https://tanstack.com/start): a catch-all server
route serves its actions over HTTP, and server functions call `app.api` as the signed-in user without passing the
request by hand. It doesn't import an identity provider or a UI library.

## Usage

Bind the app once, in a server-only module:

```ts
// src/better-apps.server.ts
import { createStartBindings } from "@better-apps/tanstack-start"
import { createBetterApps } from "better-apps"

export const app = createBetterApps({ database, identity, features: [notes] })
export const { api, handlers } = createStartBindings(app)
```

Serve the actions from a catch-all route at the app's base path, `/api/apps` unless you set `basePath`:

```ts
// src/routes/api/apps/$.ts
import { createFileRoute } from "@tanstack/react-router"
import { handlers } from "../../../better-apps.server"

export const Route = createFileRoute("/api/apps/$")({ server: { handlers } })
```

Call actions from server functions, which loaders call on the server and in the browser:

```ts
// src/notes.functions.ts
import { createServerFn } from "@tanstack/react-start"
import { api } from "./better-apps.server"

export const listNotes = createServerFn({ method: "GET" }).handler(() => api.notes.list())
```

```ts
// src/routes/index.tsx
export const Route = createFileRoute("/")({ loader: () => listNotes(), component: Notes })
```

## Delivering events after the response

Events are delivered when an action finishes. Pass `waitUntil` to read the platform's `waitUntil` from Start's request
context, so responses don't wait for delivery. On Cloudflare Workers, pass the execution context's from a server entry:

```ts
// src/server.ts
import handler from "@tanstack/react-start/server-entry"

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    handler.fetch(request, { context: { waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise) } })
}

declare module "@tanstack/react-start" {
  interface Register {
    server: { requestContext: { waitUntil: (promise: Promise<unknown>) => void } }
  }
}
```

```ts
export const { api, handlers } = createStartBindings(app, { waitUntil: (context) => context.waitUntil })
```

The reader gets the context the server entry passed, plus what global request middleware added, typed by the app's
`Register`. Without `waitUntil`, or when it returns `undefined`, responses and calls wait for delivery, as on Node.

## Behavior

- `handlers.ANY` passes every request on the route to `app.handler`, so other methods get its 405 and unknown actions
  its 404.
- `api` has the same features and actions as `app.api`. Each call reads the request being served with Start's
  `getRequest()`, so the identity adapter sees the signed-in user. Options the caller passes win: `request`, `actor`,
  `author`, `createdAt`, `silent` and `waitUntil`.
- Outside a request, such as in a script or a scheduled job, a call needs an `actor`, or it rejects. Inside global
  request middleware the request context isn't ready yet, so calls there wait for delivery.
- The package imports `@tanstack/react-start/server`, so it's for server code only. Start removes server function bodies
  and server route handlers from the browser bundle, with the imports only they use, and its import protection reports a
  server-only module that reaches the browser.

`@tanstack/react-start`, `@tanstack/react-router` and `react` are peer dependencies. Needs Node 24 or later.
