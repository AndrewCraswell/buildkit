import type { ModalActivity, ModalControls, ModalEntry, ModalHandle, ModalOpenOptions, ModalStore } from "./types.js"

type RecordEntry<TContent> = {
  entry: ModalEntry<TContent>
  settleDefault(): void
}

/** An isolated stack. Content is opaque; core has no rendering, DOM, or timer dependencies. */
export function createModalStore<TContent>(): ModalStore<TContent> {
  const empty: readonly ModalEntry<TContent>[] = Object.freeze([])
  let snapshot = empty
  let sequence = 0
  let isDisposed = false
  const records = new Map<number, RecordEntry<TContent>>()
  const listeners = new Set<() => void>()

  function publish() {
    snapshot = records.size ? Object.freeze(Array.from(records.values(), ({ entry }) => entry)) : empty
    const errors: unknown[] = []
    for (const listener of Array.from(listeners)) {
      try {
        listener()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, "Modal subscriber failed")
    }
  }

  function open<TResult>(options: ModalOpenOptions<TResult, TContent>): ModalHandle<TResult, TContent> {
    const { defaultResult, beforeDismiss } = options
    if (isDisposed) {
      throw new Error("Cannot open a modal on a disposed store")
    }
    const key = ++sequence
    const id = options.id ?? `modal-${key}`
    if (!id.trim() || Array.from(records.values()).some(({ entry }) => entry.id === id)) {
      throw new Error("Modal IDs must be non-empty and unique until exit completes")
    }
    let resolveResult: (result: TResult) => void = () => undefined
    const result = new Promise<TResult>((resolve) => {
      resolveResult = resolve
    })
    function isActive() {
      return records.get(key)?.entry.status === "open"
    }
    function settle(value: TResult) {
      const record = records.get(key)
      if (!record || !isActive()) {
        return
      }
      record.entry = Object.freeze({ ...record.entry, status: "closing", isPending: false })
      resolveResult(value)
    }
    function close(value: TResult) {
      if (!isActive()) {
        return
      }
      for (const [childKey, child] of Array.from(records).reverse()) {
        if (childKey > key) {
          child.settleDefault()
        }
      }
      settle(value)
      publish()
    }
    function setActivity(activity: ModalActivity) {
      const record = records.get(key)
      if (record && isActive()) {
        record.entry = Object.freeze({ ...record.entry, ...activity })
        publish()
      }
    }
    async function run<TValue>(
      action: () => TValue | Promise<TValue>,
      complete: (value: TValue) => boolean
    ): Promise<boolean> {
      const record = records.get(key)
      if (!record || !isActive() || record.entry.isPending) {
        return false
      }
      let value: TValue
      try {
        setActivity({ isPending: true, error: null })
        // A subscriber may have torn the host down while pending was published.
        if (!isActive()) {
          return false
        }
        value = await action()
      } catch (error) {
        setActivity({ isPending: false, error })
        return false
      }
      if (!isActive()) {
        return false
      }
      // Do not notify between unlocking and completion: subscribers must not start
      // another action in the middle of a successful settlement.
      record.entry = Object.freeze({ ...record.entry, isPending: false })
      const isComplete = complete(value)
      if (!isComplete) {
        publish()
      }
      return isComplete
    }
    function submit(action: () => TResult | Promise<TResult>) {
      return run(action, (value) => {
        close(value)
        return true
      })
    }
    function dismiss(): Promise<boolean> {
      const record = records.get(key)
      if (!record || !isActive() || record.entry.isPending) {
        return Promise.resolve(false)
      }
      if (!beforeDismiss) {
        close(defaultResult)
        return Promise.resolve(true)
      }
      const content = record.entry.content
      return run(beforeDismiss, (isAllowed) => {
        // A guard approves the state it inspected, not edits made while it waited.
        if (!isAllowed || !Object.is(content, record.entry.content)) {
          return false
        }
        close(defaultResult)
        return true
      })
    }
    function finishExit() {
      if (records.get(key)?.entry.status !== "closing") {
        return
      }
      // Descendants were settled when this entry closed. Never leave orphaned children.
      for (const childKey of records.keys()) {
        if (childKey >= key && records.get(childKey)?.entry.status === "closing") {
          records.delete(childKey)
        }
      }
      publish()
    }
    function update(updater: (content: TContent) => TContent) {
      const record = records.get(key)
      if (!record || !isActive()) {
        return
      }
      const content = updater(record.entry.content)
      if (!isActive() || Object.is(content, record.entry.content)) {
        return
      }
      record.entry = Object.freeze({ ...record.entry, content })
      publish()
    }
    const controls: ModalControls<TResult, TContent> = { id, key, close, dismiss, submit, update, isActive }
    const content = options.createContent(controls)
    const parentKey =
      Array.from(records.values())
        .reverse()
        .find(({ entry }) => entry.status === "open")?.entry.key ?? null
    const record: RecordEntry<TContent> = {
      entry: Object.freeze({
        id,
        key,
        parentKey,
        status: "open",
        content,
        dismiss,
        finishExit,
        isPending: false,
        error: null
      }),
      settleDefault: () => settle(defaultResult)
    }
    records.set(key, record)
    const handle = Object.assign(result, controls)
    publish()
    return handle
  }
  function closeAll() {
    if (!Array.from(records.values()).some(({ entry }) => entry.status === "open")) {
      return
    }
    for (const record of Array.from(records.values()).reverse()) {
      record.settleDefault()
    }
    publish()
  }
  function clear() {
    if (!records.size) {
      return
    }
    for (const record of records.values()) {
      record.settleDefault()
    }
    records.clear()
    publish()
  }
  return {
    open,
    closeAll,
    clear,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe(listener) {
      if (isDisposed) {
        throw new Error("Cannot subscribe to a disposed store")
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (isDisposed) {
        return
      }
      isDisposed = true
      try {
        clear()
      } finally {
        listeners.clear()
      }
    }
  }
}
