import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { createConfiguration } from "./index.js"
import type { ConfigurationProvider } from "./index.js"

const defaults = { checkout: false, limit: 10, variant: "standard" }
type Settings = typeof defaults
type Context = { user: string }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
describe("configuration", () => {
  it("widens inline defaults, accepts interfaces, and rejects non-scalar flag definitions", () => {
    const client = createConfiguration({
      defaults: { enabled: false, limit: 10, variant: "a" },
      context: {},
      overrides: true
    })
    expectTypeOf(client.get("enabled")).toEqualTypeOf<boolean>()
    expectTypeOf(client.get("limit")).toEqualTypeOf<number>()
    expectTypeOf(client.get("variant")).toEqualTypeOf<string>()
    client.override("enabled", true)
    interface AppFlags {
      variant: "a" | "b"
    }
    const typed = createConfiguration<AppFlags, Context>({ defaults: { variant: "a" }, context: { user: "a" } })
    expectTypeOf(typed.get("variant")).toEqualTypeOf<"a" | "b">()
    // @ts-expect-error Structured values are not supported config.
    expect(() => createConfiguration({ defaults: { nested: {} }, context: {} })).toThrow(
      "Invalid configuration setting default"
    )
    client.dispose()
    typed.dispose()
  })
  it("infers names, values and context; preserves explicitly declared unions", () => {
    const client = createConfiguration({ defaults, context: { user: "a" } })
    expectTypeOf(client.get("checkout")).toEqualTypeOf<boolean>()
    expectTypeOf(client.get("limit")).toEqualTypeOf<number>()
    expectTypeOf(client.get("variant")).toEqualTypeOf<string>()
    expectTypeOf(client.setContext).parameter(0).toEqualTypeOf<Context>()
    // @ts-expect-error Unknown setting names must not compile.
    expect(() => client.get("missing")).toThrow("Unknown settingsuration setting")
    const typed = createConfiguration<{ variant: "a" | "b" }, Context>({
      defaults: { variant: "a" },
      context: { user: "a" },
      overrides: true,
      validate: { variant: (value) => value === "a" || value === "b" }
    })
    expectTypeOf(typed.get("variant")).toEqualTypeOf<"a" | "b">()
    typed.override("variant", "b")
    // @ts-expect-error Value must match the selected flag.
    expect(() => typed.override("variant", 42)).toThrow("Invalid override")
    // @ts-expect-error Explicit unions constrain overrides.
    expect(() => typed.override("variant", "c")).toThrow("Invalid override")
    client.dispose()
    typed.dispose()
  })
  it("resolves defaults, provider and overrides; reset restores the latest provider value", async () => {
    const provider = {
      load: vi
        .fn<() => Promise<Partial<Settings> & { extra?: boolean }>>()
        .mockResolvedValue({ checkout: true, limit: 20, extra: true })
    }
    const client = createConfiguration({ defaults, context: {}, provider, overrides: true })
    const initial = client.getSnapshot()
    expect(client.getSnapshot()).toBe(initial)
    expect(client.getSetting("checkout").source).toBe("default")
    await client.refresh()
    expect(client.get("checkout")).toBe(true)
    const stable = client.getSetting("checkout")
    client.override("limit", 30)
    expect(client.getSetting("checkout")).toBe(stable)
    client.override("checkout", false)
    expect(client.getSetting("checkout").source).toBe("override")
    provider.load.mockResolvedValue({ checkout: false, limit: 25 })
    await client.refresh()
    client.reset("limit")
    expect(client.get("limit")).toBe(25)
    client.resetAll()
    expect(client.getSetting("checkout").source).toBe("provider")
    provider.load.mockResolvedValue({})
    await client.refresh()
    expect(client.getSetting("checkout").source).toBe("default")
    expect(client.getServerSnapshot()).toEqual(initial)
    expect(client.getServerSetting("checkout")).toBe(client.getServerSetting("checkout"))
    client.dispose()
  })
  it("keeps last known values on refresh failure, but clears them on a context change", async () => {
    const provider = {
      load: vi.fn<() => Promise<Partial<Settings> & { extra?: boolean }>>().mockResolvedValue({ checkout: true })
    }
    const client = createConfiguration({ defaults, context: { user: "a" }, provider })
    await client.refresh()
    provider.load.mockRejectedValue(new Error("offline"))
    await client.refresh()
    expect(client.get("checkout")).toBe(true)
    expect(client.getSnapshot().error?.message).toBe("offline")
    await client.setContext({ user: "b" })
    expect(client.get("checkout")).toBe(false)
    expect(client.getSnapshot().status).toBe("error")
    client.dispose()
  })
  it("aborts and ignores stale responses even when providers ignore cancellation", async () => {
    const first = deferred<Partial<Settings>>()
    const second = deferred<Partial<Settings>>()
    const signals: AbortSignal[] = []
    const provider: ConfigurationProvider<Settings, Context> = {
      load(context, { signal }) {
        signals.push(signal)
        return context.user === "a" ? first.promise : second.promise
      }
    }
    const client = createConfiguration({ defaults, context: { user: "a" }, provider })
    const a = client.refresh()
    const b = client.setContext({ user: "b" })
    expect(signals[0]?.aborted).toBe(true)
    second.resolve({ limit: 22 })
    await b
    first.resolve({ limit: 99 })
    await a
    expect(client.get("limit")).toBe(22)
    client.dispose()
  })
  it("disconnects invalidations, aborts pending work, and rejects mutations after disposal", async () => {
    const pending = deferred<Partial<Settings>>()
    let invalidate: () => void = () => {
      /* Assigned on subscription. */
    }
    const disconnect = vi.fn<() => void>()
    const provider = {
      load: vi.fn<() => Promise<Partial<Settings>>>(() => pending.promise),
      subscribe: vi.fn<(listener: () => void) => () => void>((listener: () => void) => {
        invalidate = listener
        return disconnect
      })
    }
    const client = createConfiguration({ defaults, context: {}, provider, overrides: true })
    const listener = vi.fn<() => void>()
    const unsubscribe = client.subscribe(listener)
    const loading = client.refresh()
    invalidate()
    expect(provider.load).toHaveBeenCalledTimes(2)
    expect(provider.subscribe).toHaveBeenCalledTimes(1)
    unsubscribe()
    const calls = listener.mock.calls.length
    client.dispose()
    client.dispose()
    pending.reject("late failure")
    await loading
    expect(disconnect).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledTimes(calls)
    expect(() => client.override("limit", 3)).toThrow("disposed")
    expect(() => client.setContext({})).toThrow("disposed")
    expect(() => client.subscribe(listener)).toThrow("disposed")
  })
  it("validates external values atomically and rejects invalid defaults", async () => {
    const provider = {
      // @ts-expect-error Simulate malformed data from an external SDK.
      load: vi.fn<() => Promise<Partial<Settings>>>().mockResolvedValue({ checkout: true, limit: "oops" })
    }
    const client = createConfiguration({ defaults, context: {}, provider, overrides: true })
    await client.refresh()
    expect(client.get("checkout")).toBe(false)
    expect(client.getSnapshot().error?.message).toContain("limit")
    // @ts-expect-error Simulate a malformed external response.
    provider.load.mockResolvedValue(null)
    await client.refresh()
    expect(client.getSnapshot().error?.message).toContain("object")
    provider.load.mockRejectedValue("disconnected")
    await client.refresh()
    expect(client.getSnapshot().error?.message).toBe("disconnected")
    expect(() => client.override("limit", Infinity)).toThrow("Invalid override")
    expect(() => createConfiguration({ defaults: { value: NaN }, context: {} })).toThrow(
      "Invalid configuration setting default"
    )
    client.dispose()
  })
  it("supports synchronous local providers and explicitly disabled overrides", async () => {
    const client = createConfiguration({ defaults, context: {} })
    await client.refresh()
    expect(client.getSnapshot().status).toBe("ready")
    expect(() => client.override("checkout", true)).toThrow("disabled")
    expect(() => client.resetAll()).toThrow("disabled")
    client.dispose()
  })
})
