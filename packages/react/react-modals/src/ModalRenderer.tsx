"use client"

import { useEffect } from "react"
import type { ModalManager, ModalSurfaceOptions } from "./types.js"
import { useModals } from "./useModals.js"

export type ModalRendererProps<TSurface = ModalSurfaceOptions> = {
  manager: ModalManager<TSurface>
}
const hosts = new WeakSet<object>()

export function ModalRenderer<TSurface>({ manager }: ModalRendererProps<TSurface>) {
  const entries = useModals(manager)
  useEffect(() => {
    if (hosts.has(manager)) {
      throw new Error("Mount only one modal renderer per manager")
    }
    hosts.add(manager)
    return () => {
      hosts.delete(manager)
      // StrictMode reconnects synchronously. An actual unmount settles pending callers.
      queueMicrotask(() => {
        if (!hosts.has(manager)) {
          manager.clear()
        }
      })
    }
  }, [manager])

  const adapter = manager.adapter
  if (!adapter) {
    throw new Error("Pass an adapter to createModalManager or create the manager with a UI package")
  }
  const { Surface } = adapter

  function renderChildren(parentKey: number | null): React.ReactNode {
    return entries
      .filter((entry) => entry.parentKey === parentKey)
      .map((entry) => (
        <Surface key={entry.key} entry={entry} body={entry.content.renderBody(entry)}>
          {renderChildren(entry.key)}
        </Surface>
      ))
  }
  return renderChildren(null)
}
