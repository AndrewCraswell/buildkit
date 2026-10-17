import { describe, expect, it, vi } from "vitest"
import { createModalStore } from "./index.js"

describe("modal lifecycle", () => {
  it("settles once, retains closing entries, and removes them after exit", async () => {
    const store = createModalStore<string>()
    const server = store.getServerSnapshot()
    const listener = vi.fn<() => void>()
    const unsubscribe = store.subscribe(listener)
    const handle = store.open({ defaultResult: false, createContent: () => "Delete?" })
    const snapshot = store.getSnapshot()
    expect(snapshot).toBe(store.getSnapshot())
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot[0])).toBe(true)
    snapshot[0].finishExit()
    expect(handle.isActive()).toBe(true)
    handle.update((value) => value)
    expect(store.getSnapshot()).toBe(snapshot)
    handle.update(() => "Delete file?")
    expect(snapshot[0].content).toBe("Delete?")
    handle.close(true)
    handle.dismiss()
    handle.close(false)
    handle.update(() => "Too late")
    expect(await handle).toBe(true)
    expect(handle.isActive()).toBe(false)
    expect(store.getSnapshot()[0].status).toBe("closing")
    expect(store.getServerSnapshot()).toBe(server)
    store.getSnapshot()[0].finishExit()
    store.getSnapshot()[0]?.finishExit()
    expect(store.getSnapshot()).toBe(server)
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    store.clear()
    store.closeAll()
  })

  it("protects reused IDs from old handles and late exit callbacks", async () => {
    const store = createModalStore<number>()
    const first = store.open({ id: "editor", defaultResult: "cancel", createContent: () => 1 })
    const entry = store.getSnapshot()[0]
    expect(() => store.open({ id: "editor", defaultResult: 0, createContent: () => 0 })).toThrow(/unique/)
    expect(() => store.open({ id: " ", defaultResult: 0, createContent: () => 0 })).toThrow(/non-empty/)
    first.dismiss()
    entry.finishExit()
    const second = store.open({ id: "editor", defaultResult: "second", createContent: () => 2 })
    first.close("stale")
    first.update(() => 9)
    entry.finishExit()
    expect(second.isActive()).toBe(true)
    expect(store.getSnapshot()[0].content).toBe(2)
    store.clear()
    expect(await first).toBe("cancel")
    expect(await second).toBe("second")
  })

  it("settles descendants on parent close without removing a subsequently opened root", async () => {
    const store = createModalStore<string>()
    const parent = store.open({ defaultResult: false, createContent: () => "parent" })
    const child = store.open({ defaultResult: "cancelled", createContent: () => "child" })
    expect(store.getSnapshot()[1].parentKey).toBe(parent.key)
    parent.close(true)
    expect(await child).toBe("cancelled")
    const later = store.open({ defaultResult: 0, createContent: () => "later" })
    expect(store.getSnapshot()[2].parentKey).toBeNull()
    store.getSnapshot()[0].finishExit()
    expect(later.isActive()).toBe(true)
    expect(store.getSnapshot()).toHaveLength(1)
    store.dispose()
    expect(await later).toBe(0)
  })

  it("closes children independently, batches closeAll, and clears on disposal", async () => {
    const store = createModalStore<null>()
    const parent = store.open({ defaultResult: null, createContent: () => null })
    const child = store.open({ defaultResult: false, createContent: () => null })
    child.close(true)
    store.getSnapshot()[1].finishExit()
    expect(parent.isActive()).toBe(true)
    const listener = vi.fn<() => void>()
    store.subscribe(listener)
    store.closeAll()
    store.closeAll()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(await child).toBe(true)
    expect(await parent).toBeNull()
    store.dispose()
    store.dispose()
    expect(store.getSnapshot()).toHaveLength(0)
    expect(() => store.open({ defaultResult: 0, createContent: () => null })).toThrow(/disposed/)
    expect(() => store.subscribe(listener)).toThrow(/disposed/)
  })

  it.each([false, true])(
    "keeps later closing siblings until their own exit completes (nested: %s)",
    async (isNested) => {
      const store = createModalStore<string>()
      const parent = isNested ? store.open({ defaultResult: false, createContent: () => "parent" }) : undefined
      const first = store.open({ defaultResult: false, createContent: () => "first" })
      const firstEntry = store.getSnapshot().at(-1)!
      first.close(true)
      const second = store.open({ defaultResult: false, createContent: () => "second" })
      const secondEntry = store.getSnapshot().at(-1)!
      expect(secondEntry.parentKey).toBe(parent?.key ?? null)
      second.close(true)

      firstEntry.finishExit()
      expect(store.getSnapshot().map((entry) => entry.content)).toEqual(isNested ? ["parent", "second"] : ["second"])
      expect(store.getSnapshot().at(-1)?.status).toBe("closing")
      secondEntry.finishExit()
      expect(store.getSnapshot().map((entry) => entry.content)).toEqual(isNested ? ["parent"] : [])
      expect(await first).toBe(true)
      expect(await second).toBe(true)
      store.dispose()
    }
  )

  it("keeps settlement and notifications consistent when a subscriber throws", async () => {
    const store = createModalStore<string>()
    const handle = store.open({ defaultResult: 0, createContent: () => "a" })
    const unsubscribe = store.subscribe(() => {
      throw new Error("consumer")
    })
    const listener = vi.fn<() => void>()
    store.subscribe(listener)
    expect(() => handle.close(3)).toThrow(AggregateError)
    expect(await handle).toBe(3)
    expect(listener).toHaveBeenCalledOnce()
    unsubscribe()
    store.dispose()
  })

  it("does not update after an updater closes its own modal", () => {
    const store = createModalStore<string>()
    const handle = store.open({ defaultResult: 0, createContent: () => "original" })
    handle.update(() => {
      handle.dismiss()
      return "ignored"
    })
    expect(store.getSnapshot()[0].content).toBe("original")
    store.clear()
  })
})

it("runs one submission at a time, exposes failures, and closes with a successful retry", async () => {
  const store = createModalStore<string>()
  const handle = store.open<string | null>({ defaultResult: null, createContent: () => "Editor" })
  const failure = new Error("Save failed")
  let rejectSave: (error: Error) => void = () => undefined
  const saving = handle.submit(
    () =>
      new Promise<string>((_, reject) => {
        rejectSave = reject
      })
  )
  expect(store.getSnapshot()[0].isPending).toBe(true)
  const duplicate = vi.fn<() => string>(() => "duplicate")
  expect(await handle.submit(duplicate)).toBe(false)
  expect(duplicate).not.toHaveBeenCalled()
  expect(await handle.dismiss()).toBe(false)
  rejectSave(failure)
  expect(await saving).toBe(false)
  expect(handle.isActive()).toBe(true)
  expect(store.getSnapshot()[0]).toMatchObject({ isPending: false, error: failure })
  expect(await handle.submit(() => "Saved")).toBe(true)
  expect(await handle).toBe("Saved")
  expect(store.getSnapshot()[0]).toMatchObject({ status: "closing", isPending: false, error: null })
  expect(await handle.submit(duplicate)).toBe(false)
  store.clear()
})

it("routes cancellation through one guard and rejects approvals for stale content", async () => {
  const store = createModalStore<string>()
  let approve: (value: boolean) => void = () => undefined
  const guard = vi.fn<() => Promise<boolean>>(
    () =>
      new Promise<boolean>((resolve) => {
        approve = resolve
      })
  )
  const handle = store.open({ defaultResult: false, createContent: () => "Original", beforeDismiss: guard })
  const dismissal = store.getSnapshot()[0].dismiss()
  expect(await handle.dismiss()).toBe(false)
  expect(guard).toHaveBeenCalledOnce()
  handle.update(() => "Changed while awaiting approval")
  approve(true)
  expect(await dismissal).toBe(false)
  expect(handle.isActive()).toBe(true)
  expect(store.getSnapshot()[0].isPending).toBe(false)
  const veto = handle.dismiss()
  approve(false)
  expect(await veto).toBe(false)
  const allowed = handle.dismiss()
  approve(true)
  expect(await allowed).toBe(true)
  expect(await handle).toBe(false)
  store.dispose()
})

it("keeps a modal open when a guard throws and allows explicit completion", async () => {
  const store = createModalStore<null>()
  const error = new Error("Could not confirm cancellation")
  const handle = store.open({
    defaultResult: false,
    createContent: () => null,
    beforeDismiss() {
      throw error
    }
  })
  expect(await handle.dismiss()).toBe(false)
  expect(store.getSnapshot()[0]).toMatchObject({ isPending: false, error })
  handle.close(true)
  expect(await handle).toBe(true)
  store.dispose()
})

it("ignores late work after teardown, even when the user ID is reused", async () => {
  const store = createModalStore<string>()
  let finish: (value: string) => void = () => undefined
  const handle = store.open({ id: "editor", defaultResult: "cancelled", createContent: () => "Original" })
  const submitting = handle.submit(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve
      })
  )
  store.clear()
  const replacement = store.open({ id: "editor", defaultResult: "replacement", createContent: () => "New" })
  finish("Late result")
  expect(await submitting).toBe(false)
  expect(await handle).toBe("cancelled")
  expect(replacement.isActive()).toBe(true)
  store.dispose()
  expect(await replacement).toBe("replacement")
})

it("does not run work after a subscriber tears down a pending modal", async () => {
  const store = createModalStore<null>()
  const handle = store.open({ defaultResult: false, createContent: () => null })
  store.subscribe(() => {
    if (store.getSnapshot()[0]?.isPending) {
      store.clear()
    }
  })
  const action = vi.fn<() => boolean>(() => true)
  expect(await handle.submit(action)).toBe(false)
  expect(action).not.toHaveBeenCalled()
  expect(await handle).toBe(false)
})
