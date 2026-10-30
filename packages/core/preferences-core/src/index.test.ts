import { expect, expectTypeOf, it, vi } from "vite-plus/test"
import { createPreferences } from "./index.js"

it("infers preference types and preserves explicit generic keys", () => {
  const inferred = createPreferences({ defaults: { pageSize: 25, compact: false } })
  inferred.set("pageSize", 50)
  expectTypeOf(inferred.get("pageSize")).toEqualTypeOf<number | undefined>()
  expectTypeOf(inferred.get("compact")).toEqualTypeOf<boolean | undefined>()
  // @ts-expect-error Only declared names can be read.
  inferred.get("unknown")
  // @ts-expect-error A boolean preference cannot receive a number.
  expect(() => inferred.set("compact", 1)).toThrow(TypeError)
  const explicit = createPreferences<{ mode: "light" | "dark"; name: string }>({ defaults: { mode: "light" } })
  explicit.set("name", "Ada")
  expectTypeOf(explicit.get("mode")).toEqualTypeOf<"light" | "dark" | undefined>()
  expectTypeOf(explicit.get("name")).toEqualTypeOf<string | undefined>()
})

it("uses defaults, optional keys, resets, and stable snapshots", () => {
  const store = createPreferences<{ theme: "system" | "dark"; pageSize: number }>({ defaults: { theme: "system" } })
  const first = store.getSnapshot()
  const listener = vi.fn<() => void>()
  const off = store.subscribe(listener)
  expect(store.get("pageSize")).toBeUndefined()
  store.set("pageSize", 50)
  expect(store.get("pageSize")).toBe(50)
  const next = store.getSnapshot()
  store.set("pageSize", 50)
  expect(store.getSnapshot()).toBe(next)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(store.getServerSnapshot()).toBe(first)
  store.reset("pageSize")
  store.set("theme", "dark")
  store.resetAll()
  expect(store.getSnapshot()).toEqual({ theme: "system" })
  expect(store.exportJson()).toBe("{}")
  off()
  const calls = listener.mock.calls.length
  store.set("theme", "dark")
  expect(listener).toHaveBeenCalledTimes(calls)
  store.dispose()
  store.dispose()
  expect(store.get("theme")).toBe("dark")
  expect(() => store.set("theme", "system")).toThrow("disposed")
  expect(() => store.subscribe(listener)).toThrow("disposed")
})

it("exports overrides and imports merge/replace atomically with one notification", () => {
  const store = createPreferences({ defaults: { page: 25, compact: false } })
  store.set("page", 25) // Explicit choices remain overrides even when equal to a default.
  expect(store.exportJson()).toBe('{"page":25}')
  const listener = vi.fn<() => void>()
  store.subscribe(listener)
  store.importJson('{"compact":true}')
  expect(store.getSnapshot()).toEqual({ page: 25, compact: true })
  expect(listener).toHaveBeenCalledTimes(1)
  const snapshot = store.getSnapshot()
  for (const input of [
    "{",
    "null",
    "[]",
    '"value"',
    '{"page":"wrong","compact":false}',
    '{"__proto__":{"polluted":true}}'
  ]) {
    expect(() => store.importJson(input)).toThrow(Error)
    expect(store.getSnapshot()).toBe(snapshot)
  }
  // @ts-expect-error Invalid mode is rejected for JavaScript consumers too.
  expect(() => store.importJson("{}", { mode: "invalid" })).toThrow(Error)
  store.importJson('{"page":50}', { mode: "replace" })
  expect(store.getSnapshot()).toEqual({ page: 50, compact: false })
  expect(listener).toHaveBeenCalledTimes(2)
  expect(store.exportJson()).toBe('{"page":50}')
})

it("copies and deeply freezes values without retaining caller-owned references", () => {
  const defaults = { layout: { columns: ["name"] } }
  const store = createPreferences({ defaults })
  defaults.layout.columns.push("mutated")
  expect(store.get("layout")).toEqual({ columns: ["name"] })
  const value = { columns: ["email"] }
  store.set("layout", value)
  value.columns.push("mutated")
  expect(store.get("layout")).toEqual({ columns: ["email"] })
  expect(Object.isFrozen(store.get("layout")?.columns)).toBe(true)
  expect(() => store.get("layout")?.columns.push("bad")).toThrow(Error)
  store.reset("layout")
  expect(store.get("layout")).toEqual({ columns: ["name"] })
})

it("rejects values that JSON would lose or silently transform", () => {
  const store = createPreferences<{ value: unknown }>()
  const circular: Record<string, unknown> = {}
  circular.self = circular
  for (const value of [
    undefined,
    NaN,
    Infinity,
    BigInt(1),
    new Date(),
    new Map(),
    () => 1,
    Symbol(),
    circular,
    { [Symbol()]: 1 },
    [undefined]
  ]) {
    expect(() => store.set("value", value)).toThrow(TypeError)
  }
  store.set("value", null)
  store.set("value", [false, 2, "value", { a: null }])
  expect(JSON.parse(store.exportJson())).toEqual({ value: [false, 2, "value", { a: null }] })
  expect(() => store.importJson('{"constructor":1}')).toThrow(Error)
})

it("checks basic default types but cannot infer missing types or enum members", () => {
  const store = createPreferences<{
    list: string[]
    count: number
    theme: "dark" | "light"
    nullable: string | null
    extra: boolean
  }>({ defaults: { list: [], count: 1, theme: "light", nullable: null } })
  for (const json of ['{"list":{}}', '{"count":[]}', '{"count":null}']) {
    expect(() => store.importJson(json)).toThrow(Error)
  }
  store.importJson('{"theme":"unknown","extra":true,"nullable":"value"}')
  expect(store.getSnapshot()).toMatchObject({ theme: "unknown", extra: true, nullable: "value" })
  store.importJson('{"additional":42}')
  expect(store.exportJson()).toContain('"additional":42')
})

it("requires a storage key iff storage is enabled", () => {
  // @ts-expect-error No storage means no key.
  expect(() => createPreferences({ key: "oops" })).toThrow(Error)
  // @ts-expect-error Storage requires a key.
  expect(() => createPreferences({ storage: "localStorage" })).toThrow(Error)
  expect(() => createPreferences({ storage: "localStorage", key: "" })).toThrow(Error)
  // @ts-expect-error Unknown mechanism.
  expect(() => createPreferences({ storage: "unknown", key: "test" })).toThrow(Error)
})
