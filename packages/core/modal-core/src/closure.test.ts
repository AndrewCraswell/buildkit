import { expect, it, vi } from "vite-plus/test"
import { createModalStore } from "./index.js"
import type { ModalCloseEvent } from "./index.js"

it.each(["close", "dismiss", "closeAll", "clear", "dispose"] as const)(
  "observes %s exactly once after publishing",
  async (operation) => {
    const store = createModalStore<null>()
    const onClose = vi.fn<(event: ModalCloseEvent<string>) => void>(() => {
      expect(store.getSnapshot().every((entry) => entry.status === "closing")).toBe(true)
    })
    const modal = store.open({ defaultResult: "cancel", createContent: () => null, onClose })
    const reasons = {
      close: "completed",
      dismiss: "dismissed",
      closeAll: "close-all",
      clear: "cleared",
      dispose: "disposed"
    }
    if (operation === "close") {
      modal.close("saved")
    } else if (operation === "dismiss") {
      await modal.dismiss()
    } else {
      store[operation]()
    }
    modal.close("ignored")
    store.dispose()
    expect(onClose).toHaveBeenCalledExactlyOnceWith({
      id: modal.id,
      result: operation === "close" ? "saved" : "cancel",
      reason: reasons[operation]
    })
    expect(await modal).toBe(operation === "close" ? "saved" : "cancel")
  }
)

it("reports parent closure for descendants and no event for a blocked dismissal", async () => {
  const store = createModalStore<null>()
  const parent = store.open({ defaultResult: null, createContent: () => null })
  const onClose = vi.fn<(event: ModalCloseEvent<null>) => void>()
  const child = store.open({ defaultResult: null, createContent: () => null, beforeDismiss: () => false, onClose })
  expect(await child.dismiss()).toBe(false)
  expect(onClose).not.toHaveBeenCalled()
  parent.close(null)
  expect(onClose).toHaveBeenCalledExactlyOnceWith({ id: child.id, result: null, reason: "parent-closed" })
  store.dispose()
})

it("settles every result and invokes other observers when an observer throws", async () => {
  const store = createModalStore<null>()
  const onClose = vi.fn<(event: ModalCloseEvent<null>) => void>()
  const parent = store.open({ defaultResult: null, createContent: () => null, onClose })
  const child = store.open({
    defaultResult: null,
    createContent: () => null,
    onClose() {
      throw new Error("Telemetry failed")
    }
  })
  expect(() => store.dispose()).toThrow(AggregateError)
  expect(store.getSnapshot()).toEqual([])
  expect(onClose).toHaveBeenCalledOnce()
  expect(await Promise.all([parent, child])).toEqual([null, null])
  expect(() => store.dispose()).not.toThrow()
})

it("allows a close observer to open a new modal without observing the old close twice", () => {
  const store = createModalStore<null>()
  const onClose = vi.fn<(event: ModalCloseEvent<null>) => void>(() => {
    store.open({ id: "next", defaultResult: null, createContent: () => null })
  })
  const modal = store.open({ defaultResult: null, createContent: () => null, onClose })
  modal.close(null)
  expect(onClose).toHaveBeenCalledOnce()
  expect(store.getSnapshot().at(-1)?.id).toBe("next")
  store.dispose()
})
