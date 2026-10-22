import { createConfiguration } from "@buildkitgg/configuration-core"
import { afterEach, expect, it } from "vitest"

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
it("hydrates only valid overrides, follows storage events, and resets persistence", async () => {
  localStorage.setItem("config-test", JSON.stringify({ enabled: true, count: "invalid" }))
  const client = createConfiguration({
    defaults: { enabled: false, count: 1 },
    context: {},
    overrides: { storage: "localStorage", key: "config-test" },
    provider: { load: () => ({ count: 5 }) }
  })
  expect(client.get("enabled")).toBe(true)
  expect(client.get("count")).toBe(1)
  expect(client.getServerSnapshot().values.enabled).toBe(false)
  await client.refresh()
  expect(client.get("count")).toBe(5)
  window.dispatchEvent(
    new StorageEvent("storage", { key: "config-test", storageArea: localStorage, newValue: '{"enabled":false}' })
  )
  expect(client.getSetting("enabled").source).toBe("override")
  expect(client.get("enabled")).toBe(false)
  client.override("count", 9)
  expect(JSON.parse(localStorage.getItem("config-test") ?? "{}")).toEqual({ enabled: false, count: 9 })
  client.resetAll()
  expect(localStorage.getItem("config-test")).toBeNull()
  expect(client.get("count")).toBe(5)
  client.dispose()
})
it("keeps session overrides and independent memory clients isolated", () => {
  const session = createConfiguration({
    defaults: { enabled: false },
    context: {},
    overrides: { storage: "sessionStorage", key: "session-config" }
  })
  const memory = createConfiguration({ defaults: { enabled: false }, context: {}, overrides: true })
  session.override("enabled", true)
  expect(memory.get("enabled")).toBe(false)
  expect(sessionStorage.getItem("session-config")).toBe('{"enabled":true}')
  expect(localStorage.getItem("session-config")).toBeNull()
  session.dispose()
  memory.dispose()
})
