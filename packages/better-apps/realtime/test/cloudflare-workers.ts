// Stands in for Workers' `cloudflare:workers` module in Node tests. Tests put bindings on `env`; Durable Objects run
// for real in src/workerd.test.ts.
export const env: Record<string, unknown> = {}

export abstract class DurableObject {
  protected ctx: unknown
  protected env: unknown

  constructor(ctx: unknown, workerEnv: unknown) {
    this.ctx = ctx
    this.env = workerEnv
  }
}
