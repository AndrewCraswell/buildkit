// Workers provide this module. The adapter needs only these parts, so it needs no Workers types.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>
  export abstract class DurableObject {
    constructor(ctx: never, env: never)
  }
}
