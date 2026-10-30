import { describe, expect, it, vi } from "vite-plus/test"
import { createThemeStore, isTheme } from "./index.js"

describe("theme store", () => {
  it("resets to the configured default without exposing persistence internals", () => {
    const store = createThemeStore({ defaultTheme: "dark" })
    store.setTheme("light")
    store.reset()
    expect(store.getSnapshot().resolvedTheme).toBe("dark")
    store.setTheme("system")
    store.reset()
    expect(store.getSnapshot().theme).toBe("dark")
    expect("preferences" in store).toBe(false)
  })
  it("resolves system preferences and keeps unchanged snapshots stable", () => {
    const store = createThemeStore()
    const initial = store.getSnapshot()
    const listener = vi.fn<() => void>()
    const unsubscribe = store.subscribe(listener)
    store.setTheme("system")
    expect(store.getSnapshot()).toBe(initial)
    store.setSystemTheme("dark")
    expect(store.getSnapshot()).toEqual({ theme: "system", resolvedTheme: "dark" })
    store.setTheme("light")
    const explicit = store.getSnapshot()
    store.setSystemTheme("light")
    expect(store.getSnapshot()).toBe(explicit)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.getServerSnapshot()).toBe(initial)
    unsubscribe()
    store.setTheme("dark")
    expect(listener).toHaveBeenCalledTimes(2)
  })
  it("isolates instances and freezes snapshots", () => {
    const one = createThemeStore({ defaultTheme: "dark" })
    const two = createThemeStore({ systemTheme: "dark" })
    one.setTheme("light")
    expect(two.getSnapshot().resolvedTheme).toBe("dark")
    expect(Object.isFrozen(one.getSnapshot())).toBe(true)
    expect(isTheme("invalid")).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
  it("rejects invalid calls from JavaScript", () => {
    // @ts-expect-error Initial configuration is a runtime boundary too.
    expect(() => createThemeStore({ defaultTheme: "invalid" })).toThrow(TypeError)
    // @ts-expect-error A system appearance cannot itself be system.
    expect(() => createThemeStore({ systemTheme: "system" })).toThrow(TypeError)
    const store = createThemeStore()
    // @ts-expect-error Intentional runtime boundary check.
    expect(() => store.setTheme("invalid")).toThrow(TypeError)
    // @ts-expect-error Intentional runtime boundary check.
    expect(() => store.setSystemTheme("system")).toThrow(TypeError)
  })
})
