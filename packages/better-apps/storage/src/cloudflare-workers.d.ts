// Workers provide this module. The adapter only reads `env`, so it needs no Workers types.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>
}
