import { definePoint } from "@buildkitgg/scaffolder"

/** Where the generated glue lives. Each file is split by where it runs; the target's starter files import them once. */
export const generatedFolder = "src/generated/buildkit"
const config = `${generatedFolder}/config.ts`
const client = `${generatedFolder}/client.ts`
const server = `${generatedFolder}/server.ts`

/** The TanStack Start target's extension points. Each is wired into a starter file at `init`. */
export const startPoints = [
  definePoint({
    id: "vite.plugins",
    version: 1,
    kind: "list",
    title: "Vite plugins: pre, then framework (before tanstackStart()), then post",
    file: config,
    export: "vitePlugins"
  }),
  definePoint({
    id: "server.requestMiddleware",
    version: 1,
    kind: "chain",
    title: "Global request middleware, after Start's CSRF check",
    file: server,
    export: "requestMiddleware"
  }),
  definePoint({
    id: "app.providers",
    version: 1,
    kind: "nest",
    title: "React providers around every page, outermost first",
    file: client,
    export: "appProviders"
  }),
  definePoint({
    id: "app.bootstrap",
    version: 1,
    kind: "list",
    title: "Steps the browser finishes before it renders the app",
    file: client,
    export: "appBootstrap"
  }),
  definePoint({
    id: "router.wrappers",
    version: 1,
    kind: "wrap",
    title: "Functions that extend the router getRouter() creates",
    file: client,
    export: "routerWrappers"
  }),
  definePoint({
    id: "router.rewrite",
    version: 1,
    kind: "single",
    title: "The router's URL rewrite",
    file: client,
    export: "routerRewrite"
  }),
  definePoint({
    id: "html.attributes",
    version: 1,
    kind: "single",
    title: "A hook that returns the <html> element's attributes",
    file: client,
    export: "htmlAttributes"
  })
]
