"use client"

import { createModalStore } from "@buildkitgg/modal-core"
import { createElement } from "react"
import type {
  ModalControls,
  ModalHandle,
  ModalManager,
  ModalManagerOptions,
  ModalSurfaceOptions,
  ModalView
} from "./types.js"

function isStateFactory<TData extends object>(value: TData | (() => TData)): value is () => TData {
  return typeof value === "function"
}

/** Shared React orchestration. UI adapters supply surfaces, never a second manager implementation. */
export function createModalManager<TSurface = ModalSurfaceOptions>(
  options: ModalManagerOptions<TSurface> = {}
): ModalManager<TSurface> {
  const store = createModalStore<ModalView<TSurface>>()
  const labels = { confirm: "Confirm", cancel: "Cancel", close: "Close", ...options.labels }

  function openData<TData extends object, TResult>(
    initialData: TData,
    modalOptions: {
      id?: string
      defaultResult: TResult
      beforeDismiss?(data: Readonly<TData>): boolean | Promise<boolean>
    },
    createView: (data: Readonly<TData>, controls: ModalControls<TResult, TData>) => ModalView<TSurface>
  ): ModalHandle<TResult, TData> {
    let data: Readonly<TData> = Object.freeze({ ...initialData })
    const returnFocus =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined
    let controls: ModalControls<TResult, TData> | undefined
    const { beforeDismiss } = modalOptions
    const handle = store.open({
      ...modalOptions,
      beforeDismiss: beforeDismiss ? () => beforeDismiss(data) : undefined,
      createContent(coreControls) {
        controls = {
          id: coreControls.id,
          close: coreControls.close,
          dismiss: coreControls.dismiss,
          submit: (action) => coreControls.submit(() => action(data)),
          isActive: coreControls.isActive,
          update(patch) {
            coreControls.update(() => {
              const changes = typeof patch === "function" ? patch(data) : patch
              data = Object.freeze({ ...data, ...changes })
              return { ...createView(data, controls!), returnFocus }
            })
          }
        }
        return { ...createView(data, controls), returnFocus }
      }
    })
    // Keep the core handle's updater private. The public updater patches this modal's typed data.
    return Object.assign(
      handle.then((value) => value),
      controls!
    )
  }

  const manager: ModalManager<TSurface> = {
    adapter: options.adapter ? Object.freeze({ ...options.adapter }) : undefined,
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: store.getServerSnapshot,
    closeAll: store.closeAll,
    clear: store.clear,
    dispose: store.dispose,
    open(initial) {
      return openData(initial, { id: initial.id, defaultResult: undefined }, (data, controls) => ({
        ...data,
        renderBody: () => data.children,
        actions: [{ label: data.closeLabel ?? labels.close, appearance: "secondary", onClick: controls.dismiss }]
      }))
    },
    alert(initial) {
      return manager.open(initial)
    },
    confirm(initial) {
      return openData(initial, { id: initial.id, defaultResult: false }, (data, controls) => ({
        ...data,
        renderBody: () => data.children,
        actions: [
          { label: data.cancelLabel ?? labels.cancel, appearance: "secondary", onClick: controls.dismiss },
          { label: data.confirmLabel ?? labels.confirm, appearance: "primary", onClick: () => controls.close(true) }
        ]
      }))
    },
    createModal({ render: Component, initialState, beforeDismiss, defaultResult, ...viewOptions }) {
      // Capture the top-level defaults; callers must treat nested values as immutable.
      const defaults = isStateFactory(initialState) ? initialState : Object.freeze({ ...initialState })
      return {
        open(overrides, instanceOptions) {
          const initial = isStateFactory(defaults) ? defaults() : defaults
          return openData(
            { ...initial, ...overrides },
            { id: instanceOptions?.id ?? viewOptions.id, defaultResult, beforeDismiss },
            (currentData, controls) => ({
              ...viewOptions,
              renderBody: (activity) => createElement(Component, { data: currentData, controls, ...activity }),
              actions: []
            })
          )
        }
      }
    }
  }
  return manager
}
