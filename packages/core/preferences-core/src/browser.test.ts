import { afterEach, expect, it, vi } from "vitest"
import { connectPreferencesStorage } from "./browser.js"
import { createPreferences } from "./index.js"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

it.each(["localStorage", "sessionStorage"] as const)("loads and persists overrides using %s", (storage) => {
  window[storage].setItem("prefs", '{"page":50}')
  const store = createPreferences({ defaults: { page: 25 }, storage, key: "prefs" })
  expect(store.get("page")).toBe(50)
  expect(store.getServerSnapshot()).toEqual({ page: 25 })
  store.set("page", 75)
  expect(window[storage].getItem("prefs")).toBe('{"page":75}')
  store.resetAll()
  expect(window[storage].getItem("prefs")).toBeNull()
  store.dispose()
  window.dispatchEvent(
    new StorageEvent("storage", { key: "prefs", newValue: '{"page":10}', storageArea: window[storage] })
  )
  expect(store.get("page")).toBe(25)
})

it("accepts remote changes without echo, ignores other storage areas, and handles clear", () => {
  const store = createPreferences({ defaults: { page: 25 }, storage: "localStorage", key: "prefs" })
  const write = vi.spyOn(Storage.prototype, "setItem")
  window.dispatchEvent(
    new StorageEvent("storage", { key: "other", newValue: '{"page":10}', storageArea: localStorage })
  )
  window.dispatchEvent(
    new StorageEvent("storage", { key: "prefs", newValue: '{"page":10}', storageArea: sessionStorage })
  )
  expect(store.get("page")).toBe(25)
  window.dispatchEvent(
    new StorageEvent("storage", { key: "prefs", newValue: '{"page":10}', storageArea: localStorage })
  )
  expect(store.get("page")).toBe(10)
  expect(write).not.toHaveBeenCalled()
  window.dispatchEvent(new StorageEvent("storage", { key: null, newValue: null, storageArea: localStorage }))
  expect(store.get("page")).toBe(25)
  store.dispose()
})

it("uses memory for blocked storage and ignores malformed persisted data", () => {
  localStorage.setItem("prefs", "broken")
  createPreferences({ defaults: { page: 25 }, storage: "localStorage", key: "prefs" }).dispose()
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked")
  })
  const store = createPreferences({ defaults: { page: 25 }, storage: "localStorage", key: "prefs" })
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota")
  })
  expect(() => store.set("page", 50)).not.toThrow()
  expect(store.get("page")).toBe(50)
  store.dispose()
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("denied")
  })
  createPreferences({ storage: "localStorage", key: "prefs" }).dispose()
})

it("supports SSR and explicit disposable connections", () => {
  const store = createPreferences({ defaults: { page: 25 } })
  const stop = connectPreferencesStorage(store, { storage: "localStorage", key: "prefs", window })
  stop()
  store.set("page", 50)
  expect(localStorage.getItem("prefs")).toBeNull()
  vi.stubGlobal("window", undefined)
  createPreferences({ storage: "sessionStorage", key: "prefs" }).dispose()
})
