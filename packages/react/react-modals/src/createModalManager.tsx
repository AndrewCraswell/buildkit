"use client"

import { createModalStore } from "@buildkitgg/modal-core"
import { createElement } from "react"
import { DefaultFooter, renderSlot, validateName } from "./slots.js"
import type {
  CreateModalOptions,
  ModalControls,
  ModalManager,
  ModalManagerOptions,
  ModalState,
  ModalStateUpdate,
  ModalSurfaceOptions,
  ModalUpdate,
  ModalView,
  StandardModalOptions,
  ModalCloseEvent,
  StandardModalHandle
} from "./types.js"

type InstanceControls<TResult, TData extends object, TState extends object, TPatch> = Omit<
  ModalControls<TResult, TData>,
  "update"
> & {
  update(patch: ModalStateUpdate<TState, TPatch>): void
}

function mergeState<T extends object>(current: T, patch: Partial<T>): T {
  if (Reflect.ownKeys(patch).every((key) => Object.is(Reflect.get(current, key), Reflect.get(patch, key)))) {
    return current
  }
  return Object.freeze({ ...current, ...patch })
}

function isStateFactory<TData extends object>(value: TData | (() => TData)): value is () => TData {
  return typeof value === "function"
}

function isUpdateFunction<TState extends object, TPatch>(
  patch: ModalStateUpdate<TState, TPatch>
): patch is (current: Readonly<TState>) => TPatch {
  return typeof patch === "function"
}

/** Shared React orchestration. UI adapters supply surfaces, never a second manager implementation. */
export function createModalManager<TSurface = ModalSurfaceOptions>(
  options: ModalManagerOptions<TSurface> = {}
): ModalManager<TSurface> {
  const store = createModalStore<ModalView<TSurface>>()
  const adapter = options.adapter ? Object.freeze({ ...options.adapter }) : undefined
  const labels = { confirm: "Confirm", cancel: "Cancel", close: "Close", ...options.labels }

  function openState<
    TState extends { title: unknown; ariaLabel?: string; onClose?: ((event: ModalCloseEvent<TResult>) => void) | null },
    TPatch,
    TData extends object,
    TResult
  >(
    initial: TState,
    modalOptions: {
      id?: string
      defaultResult: TResult
      beforeDismiss?(data: Readonly<TData>): boolean | Promise<boolean>
    },
    getData: (state: Readonly<TState>) => Readonly<TData>,
    merge: (state: Readonly<TState>, patch: TPatch) => TState,
    createView: (
      state: Readonly<TState>,
      controls: InstanceControls<TResult, TData, TState, TPatch>
    ) => ModalView<TSurface>
  ) {
    validateName(initial)
    let state: Readonly<TState> = Object.freeze(initial)
    const returnFocus =
      typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined
    let controls: InstanceControls<TResult, TData, TState, TPatch> | undefined
    const { beforeDismiss } = modalOptions
    const handle = store.open({
      ...modalOptions,
      beforeDismiss: beforeDismiss ? () => beforeDismiss(getData(state)) : undefined,
      onClose: (event) => state.onClose?.(event),
      createContent(coreControls) {
        controls = {
          id: coreControls.id,
          close: coreControls.close,
          dismiss: coreControls.dismiss,
          submit: (action) => coreControls.submit(() => action(getData(state))),
          isActive: coreControls.isActive,
          update(patch) {
            coreControls.update((content) => {
              const changes = isUpdateFunction(patch) ? patch(state) : patch
              if (!coreControls.isActive()) {
                return content
              }
              const next = merge(state, changes)
              validateName(next)
              if (Object.is(next, state)) {
                return content
              }
              state = Object.freeze(next)
              return { ...createView(state, controls!), returnFocus }
            })
          }
        }
        return { ...createView(state, controls), returnFocus }
      }
    })
    // Expose the typed updater rather than the core content replacement function.
    return Object.assign(
      handle.then((value) => value),
      controls!
    )
  }

  function openStandard<TResult>(
    initial: StandardModalOptions<TSurface, TResult>,
    defaultResult: TResult,
    kind: "close" | "confirm",
    completionResult: TResult
  ): StandardModalHandle<TResult, StandardModalOptions<TSurface, TResult>> {
    type Options = StandardModalOptions<TSurface, TResult>
    return openState<Options, Partial<Omit<Options, "id">>, Options, TResult>(
      { ...initial },
      { id: initial.id, defaultResult },
      (state) => state,
      (state, patch) => mergeState(state, { ...patch, id: state.id }),
      (state, controls) => ({
        id: controls.id,
        description: state.description,
        ariaLabel: state.ariaLabel,
        surfaceProps: state.surfaceProps,
        dismissible: state.dismissible,
        renderSlots(activity) {
          const props = { data: state, controls, isPending: activity.isPending, error: activity.error }
          return {
            title: renderSlot(state.title, props),
            body: renderSlot(state.body, props),
            footer:
              state.footer === undefined
                ? createElement(adapter?.DefaultFooter ?? DefaultFooter, {
                    kind,
                    labels: {
                      close: state.closeLabel ?? labels.close,
                      cancel: state.cancelLabel ?? labels.cancel,
                      confirm: state.confirmLabel ?? labels.confirm
                    },
                    isPending: activity.isPending,
                    dismiss: controls.dismiss,
                    confirm: () => controls.close(completionResult)
                  })
                : renderSlot(state.footer, props)
          }
        }
      })
    )
  }

  const manager: ModalManager<TSurface> = {
    adapter,
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: store.getServerSnapshot,
    closeAll: store.closeAll,
    clear: store.clear,
    dispose: store.dispose,
    open(initial) {
      return openStandard(initial, undefined, "close", undefined)
    },
    alert(initial) {
      return manager.open(initial)
    },
    confirm(initial) {
      return openStandard(initial, false, "confirm", true)
    },
    createModal<TData extends object, TResult = TData | null>({
      initialState,
      beforeDismiss,
      defaultResult,
      id,
      ...presentation
    }: CreateModalOptions<TData, TResult, TSurface>) {
      const defaults = isStateFactory(initialState) ? initialState : Object.freeze({ ...initialState })
      return {
        open(overrides, instanceOptions) {
          const initial = isStateFactory(defaults) ? defaults() : defaults
          return openState<ModalState<TData, TSurface, TResult>, ModalUpdate<TData, TSurface, TResult>, TData, TResult>(
            { ...presentation, data: Object.freeze({ ...initial, ...overrides }) },
            { id: instanceOptions?.id ?? id, defaultResult, beforeDismiss },
            (state) => state.data,
            (state, patch) =>
              mergeState(state, {
                ...patch,
                data: patch.data === undefined ? state.data : mergeState(state.data, patch.data)
              }),
            ({ data, title, body, footer, onClose: _onClose, ...viewOptions }, controls) => ({
              ...viewOptions,
              id: controls.id,
              renderSlots(activity) {
                const props = { data, controls, isPending: activity.isPending, error: activity.error }
                return {
                  title: renderSlot(title, props),
                  body: renderSlot(body, props),
                  footer: renderSlot(footer, props)
                }
              }
            })
          )
        }
      }
    }
  }
  return manager
}
