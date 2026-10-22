import { act, cleanup, renderHook } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, expect, expectTypeOf, it } from "vitest"
import { createConfiguration } from "./index.js"

afterEach(cleanup)
it("preserves inferred types and supports destructured bound hooks", async () => {
  const config = createConfiguration({
    defaults: { enabled: false, limit: 10 },
    context: { account: "free" },
    provider: { load: (context) => ({ enabled: context.account === "pro" }) },
    overrides: true
  })
  const { useSetting, useConfiguration, get, setContext, override, reset } = config
  const result = renderHook(() => ({
    flag: useSetting("enabled"),
    snapshot: useConfiguration()
  }))
  expectTypeOf(result.result.current.flag.value).toEqualTypeOf<boolean>()
  expectTypeOf(get("limit")).toEqualTypeOf<number>()
  expectTypeOf(setContext).parameter(0).toEqualTypeOf<{ account: string }>()
  await act(() => setContext({ account: "pro" }))
  expect(result.result.current.flag.value).toBe(true)
  act(() => override("enabled", false))
  expect(result.result.current.flag.source).toBe("override")
  act(() => reset("enabled"))
  expect(result.result.current.flag.source).toBe("provider")
  const typed = createConfiguration<{ variant: "a" | "b" }, {}>({
    defaults: { variant: "a" },
    context: {},
    overrides: true
  })
  const union = renderHook(() => typed.useSetting("variant"))
  expectTypeOf(union.result.current.value).toEqualTypeOf<"a" | "b">()
  // @ts-expect-error Keys remain constrained to the declared settings.
  expect(() => get("missing")).toThrow("Unknown settingsuration setting")
  // @ts-expect-error Values remain constrained to the selected flag.
  expect(() => override("enabled", 42)).toThrow("Invalid override")
  result.unmount()
  union.unmount()
  config.dispose()
  typed.dispose()
})
it("hydrates defaults before reflecting browser overrides without a mismatch", async () => {
  const client = createConfiguration({ defaults: { enabled: false }, context: {}, overrides: true })
  client.override("enabled", true)
  function View() {
    const flag = client.useSetting("enabled")
    const snapshot = client.useConfiguration()
    return (
      <p>
        {String(flag.value)}:{snapshot.status}
      </p>
    )
  }
  const container = document.createElement("div")
  container.innerHTML = renderToString(<View />)
  expect(container.textContent).toBe("false:idle")
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, <View />, { onRecoverableError: (error) => errors.push(error) })
  })
  expect(container.textContent).toBe("true:idle")
  expect(errors).toEqual([])
  act(() => root?.unmount())
  client.dispose()
})
it("subscribes without a provider component and follows a replacement client", async () => {
  const first = createConfiguration({ defaults: { enabled: false, count: 1 }, context: {}, overrides: true })
  const second = createConfiguration({ defaults: { enabled: true, count: 2 }, context: {}, overrides: true })
  let renders = 0
  const flag = renderHook(
    ({ client, name }: { client: typeof first; name: "enabled" | "count" }) => {
      renders++
      return client.useSetting(name)
    },
    { initialProps: { client: first, name: "enabled" } }
  )
  const all = renderHook(() => first.useConfiguration())
  const before = renders
  act(() => first.override("count", 3))
  expect(renders).toBe(before)
  expect(all.result.current.values.count).toBe(3)
  act(() => first.override("enabled", true))
  expect(flag.result.current.value).toBe(true)
  flag.rerender({ client: second, name: "count" })
  expect(flag.result.current.value).toBe(2)
  await act(() => first.refresh())
  expect(all.result.current.status).toBe("ready")
  flag.unmount()
  all.unmount()
  first.dispose()
  second.dispose()
})
