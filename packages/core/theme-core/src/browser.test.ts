import { afterEach, expect, it, vi } from "vite-plus/test"
import { connectBrowserTheme } from "./browser.js"
import { createThemeStore } from "./index.js"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

it("loads valid preferences, writes local changes, and accepts remote reset without echo", () => {
  localStorage.setItem("theme", '{"theme":"dark"}')
  const store = createThemeStore()
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  expect(store.getSnapshot().theme).toBe("dark")
  store.setTheme("light")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
  window.dispatchEvent(
    new StorageEvent("storage", { key: "unrelated", newValue: '{"theme":"dark"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("light")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"dark"}', storageArea: sessionStorage })
  )
  expect(store.getSnapshot().theme).toBe("light")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"dark"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
  window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null, storageArea: localStorage }))
  expect(store.getSnapshot().theme).toBe("system")
  stop()
  store.setTheme("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"light"}')
})

it("tracks system changes, but honors explicit preference and disconnects", () => {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  vi.spyOn(window, "matchMedia").mockReturnValue(media)
  const store = createThemeStore()
  const stop = connectBrowserTheme(store)
  vi.spyOn(media, "matches", "get").mockReturnValue(true)
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("dark")
  store.setTheme("light")
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("light")
  stop()
  store.setTheme("system")
  vi.spyOn(media, "matches", "get").mockReturnValue(false)
  media.dispatchEvent(new Event("change"))
  expect(store.getSnapshot().resolvedTheme).toBe("dark")
})

it("ignores corrupt storage and tolerates blocked reads and writes", () => {
  localStorage.setItem("theme", "corrupt")
  const store = createThemeStore({ defaultTheme: "light" })
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  expect(store.getSnapshot().theme).toBe("light")
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota")
  })
  expect(() => store.setTheme("dark")).not.toThrow()
  stop()
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  connectBrowserTheme(store, { storageKey: "theme" })()
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked")
  })
  connectBrowserTheme(store, { storageKey: "theme" })()
})

it("does not touch storage unless enabled and can be imported without a browser", () => {
  const read = vi.spyOn(window, "localStorage", "get")
  connectBrowserTheme(createThemeStore())()
  expect(read).not.toHaveBeenCalled()
  vi.stubGlobal("window", undefined)
  expect(() => connectBrowserTheme(createThemeStore())()).not.toThrow()
})

it("reset removes a saved override even when it matches the default", () => {
  const store = createThemeStore({ defaultTheme: "dark" })
  const stop = connectBrowserTheme(store, { storageKey: "theme" })
  store.setTheme("dark")
  expect(localStorage.getItem("theme")).toBe('{"theme":"dark"}')
  store.reset()
  expect(localStorage.getItem("theme")).toBeNull()
  expect(store.getSnapshot().theme).toBe("dark")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "theme", newValue: '{"theme":"unknown"}', storageArea: localStorage })
  )
  expect(store.getSnapshot().theme).toBe("dark")
  stop()
})

it("rejects foreign stores instead of exposing a preferences contract", () => {
  const store = createThemeStore()
  expect(() => connectBrowserTheme({ ...store, getSnapshot: () => store.getSnapshot() })).toThrow(TypeError)
})

it("rejects incomplete storage configuration before opening browser resources", () => {
  const store = createThemeStore()
  // @ts-expect-error Storage selection requires a key.
  expect(() => connectBrowserTheme(store, { storage: "localStorage" })).toThrow(TypeError)
  expect(() => connectBrowserTheme(store, { storageKey: "" })).toThrow(TypeError)
  // @ts-expect-error Unknown storage mechanism.
  expect(() => connectBrowserTheme(store, { storageKey: "theme", storage: "unknown" })).toThrow(TypeError)
})
