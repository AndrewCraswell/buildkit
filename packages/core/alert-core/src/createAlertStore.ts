import type { AlertEntry, AlertHandle, AlertOptions, AlertPatch, AlertStore } from "./types.js"

/** Persistent, isolated inline alerts. Payloads belong to the caller; no browser or UI dependencies. */
export function createAlertStore<T = string>(): AlertStore<T> {
  const empty: readonly AlertEntry<T>[] = Object.freeze([])
  const regions = new Map<string, readonly AlertEntry<T>[]>()
  const listeners = new Map<string, Set<() => void>>()
  let sequence = 0
  let isDisposed = false
  function getSnapshot(region = "default") {
    return regions.get(region) ?? empty
  }
  function find(id: string, region: string) {
    return getSnapshot(region).find((entry) => entry.id === id)
  }
  function notify(callbacks: readonly (() => void)[]) {
    const errors: unknown[] = []
    for (const callback of callbacks) {
      try {
        callback()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, "Alert callbacks failed")
    }
  }
  function write(region: string, entries: readonly AlertEntry<T>[]) {
    if (entries.length) {
      regions.set(region, Object.freeze(entries))
    } else {
      regions.delete(region)
    }
  }
  function publish(region: string, callbacks: (() => void)[] = []) {
    notify([...(listeners.get(region) ?? []), ...callbacks])
  }
  function update(id: string, patch: AlertPatch<T>, region = "default") {
    const current = find(id, region)
    if (!current) {
      return
    }
    const next = Object.freeze({
      ...current,
      ...patch,
      id: current.id,
      region,
      key: current.key,
      intent: patch.intent ?? current.intent,
      dismissible: patch.dismissible ?? current.dismissible,
      action: "action" in patch ? patch.action && Object.freeze({ ...patch.action }) : current.action
    })
    write(
      region,
      getSnapshot(region).map((entry) => (entry === current ? next : entry))
    )
    publish(region)
  }
  function dismiss(id: string, region = "default") {
    const current = find(id, region)
    if (!current) {
      return
    }
    write(
      region,
      getSnapshot(region).filter((entry) => entry !== current)
    )
    publish(region, current.onDismiss ? [current.onDismiss] : [])
  }
  function add(options: AlertOptions<T>, region = "default"): AlertHandle<T> {
    if (isDisposed) {
      throw new Error("Cannot add to a disposed alert store")
    }
    const key = ++sequence
    let id = options.id ?? `alert-${key}`
    while (options.id === undefined && find(id, region)) {
      id = `alert-${++sequence}`
    }
    const current = find(id, region)
    const entry: AlertEntry<T> = Object.freeze({
      ...options,
      id,
      region,
      key,
      intent: options.intent ?? "info",
      dismissible: options.dismissible ?? true,
      action: options.action && Object.freeze({ ...options.action })
    })
    write(
      region,
      current ? getSnapshot(region).map((item) => (item === current ? entry : item)) : [...getSnapshot(region), entry]
    )
    publish(region)
    const isActive = () => find(id, region)?.key === key
    return {
      id,
      region,
      get isActive() {
        return isActive()
      },
      update(patch) {
        if (isActive()) {
          update(id, patch, region)
        }
      },
      dismiss() {
        if (isActive()) {
          dismiss(id, region)
        }
      }
    }
  }
  function clear() {
    const affected = [...regions.keys()]
    regions.clear()
    notify(affected.flatMap((region) => [...(listeners.get(region) ?? [])]))
  }
  return {
    add,
    info: (options, region) => add({ ...options, intent: "info" }, region),
    success: (options, region) => add({ ...options, intent: "success" }, region),
    warning: (options, region) => add({ ...options, intent: "warning" }, region),
    error: (options, region) => add({ ...options, intent: "error" }, region),
    getSnapshot,
    getServerSnapshot: () => empty,
    subscribe(listener, region = "default") {
      if (isDisposed) {
        return () => undefined
      }
      let group = listeners.get(region)
      if (!group) {
        group = new Set()
        listeners.set(region, group)
      }
      group.add(listener)
      return () => {
        group.delete(listener)
        if (!group.size && listeners.get(region) === group) {
          listeners.delete(region)
        }
      }
    },
    isActive: (id, region = "default") => Boolean(find(id, region)),
    update,
    dismiss,
    dismissAll(region = "default") {
      const entries = getSnapshot(region)
      if (!entries.length) {
        return
      }
      write(region, empty)
      publish(
        region,
        entries.flatMap((entry) => (entry.onDismiss ? [entry.onDismiss] : []))
      )
    },
    flush: clear,
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
