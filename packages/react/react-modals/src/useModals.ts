"use client"

import type { ModalEntry, ModalStore } from "@buildkitgg/modal-core"
import { useSyncExternalStore } from "react"

/** Works with the plain core store and with a React modal manager; no context provider. */
export function useModals<TContent>(
  store: Pick<ModalStore<TContent>, "subscribe" | "getSnapshot" | "getServerSnapshot">
): readonly ModalEntry<TContent>[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
