import type { ModalActivity, ModalCloseEvent, ModalEntry, ModalStore } from "@buildkitgg/modal-core"
import type { ComponentType, CSSProperties, ReactNode } from "react"

export type { ModalCloseEvent, ModalCloseReason } from "@buildkitgg/modal-core"
export type ModalLabels = { confirm: ReactNode; cancel: ReactNode; close: ReactNode }
export type ModalManagerOptions<TSurface = ModalSurfaceOptions> = {
  labels?: Partial<ModalLabels>
  adapter?: ModalAdapter<TSurface>
}
/** UI bindings captured once per manager. DefaultFooter styles only the built-in helper buttons. */
export type ModalAdapter<TSurface = ModalSurfaceOptions> = Readonly<{
  Surface: ComponentType<ModalSurfaceProps<TSurface>>
  DefaultFooter?: ComponentType<ModalDefaultFooterProps>
}>
export type ModalDefaultFooterProps = {
  kind: "close" | "confirm"
  labels: ModalLabels
  isPending: boolean
  dismiss(): Promise<boolean>
  confirm(): void
}
export type ModalSurfaceOptions = { className?: string; style?: CSSProperties }
/** Nodes are rendered directly. Component slots receive live props with normal React hook semantics. */
export type ModalSlot<TProps> = ReactNode | { component: ComponentType<TProps> }
export type ModalSlots<TProps> = {
  title: ModalSlot<TProps>
  body?: ModalSlot<TProps>
  footer?: ModalSlot<TProps>
}
export type ModalOptions<TSurface> = {
  id?: string
  title: ReactNode
  body?: ReactNode
  footer?: ReactNode
  description?: ReactNode
  /** Required when the title is absent or has no accessible text. Overrides title-based naming. */
  ariaLabel?: string
  surfaceProps?: TSurface
  dismissible?: boolean
}
export type StandardModalOptions<TSurface, TResult> = Omit<ModalOptions<TSurface>, keyof ModalSlots<never>> &
  ModalSlots<StandardModalSlotProps<TSurface, TResult>> & {
    closeLabel?: ReactNode
    confirmLabel?: ReactNode
    cancelLabel?: ReactNode
    onClose?: ((event: ModalCloseEvent<TResult>) => void) | null
  }
export type OpenModalOptions<TSurface> = StandardModalOptions<TSurface, void>
export type ConfirmModalOptions<TSurface> = StandardModalOptions<TSurface, boolean>
export type ModalStateUpdate<TState extends object, TPatch = Partial<TState>> =
  | TPatch
  | ((current: Readonly<TState>) => TPatch)
/** Current per-instance slots, presentation, callback and custom data. */
export type ModalState<TData extends object, TSurface = ModalSurfaceOptions, TResult = TData | null> = Readonly<
  Omit<ModalOptions<TSurface>, "id" | keyof ModalSlots<never>> &
    ModalSlots<ModalSlotProps<TData, TResult, TSurface>> & {
      data: Readonly<TData>
      onClose?: ((event: ModalCloseEvent<TResult>) => void) | null
    }
>
export type ModalUpdate<TData extends object, TSurface = ModalSurfaceOptions, TResult = TData | null> = Partial<
  Omit<ModalState<TData, TSurface, TResult>, "data">
> & { data?: Partial<TData> }
export type ModalControls<TResult, TData extends object, TSurface = ModalSurfaceOptions> = {
  readonly id: string
  close(result: TResult): void
  dismiss(): Promise<boolean>
  submit(action: (data: Readonly<TData>) => TResult | Promise<TResult>): Promise<boolean>
  update(patch: ModalStateUpdate<ModalState<TData, TSurface, TResult>, ModalUpdate<TData, TSurface, TResult>>): void
  isActive(): boolean
}
export type ModalHandle<TResult, TData extends object, TSurface = ModalSurfaceOptions> = Promise<TResult> &
  ModalControls<TResult, TData, TSurface>
export type StandardModalHandle<TResult, TOptions extends object> = Promise<TResult> &
  Omit<ModalControls<TResult, TOptions>, "update"> & {
    update(patch: ModalStateUpdate<Omit<TOptions, "id">>): void
  }
export type StandardModalSlotProps<TSurface, TResult> = ModalActivity & {
  data: Readonly<StandardModalOptions<TSurface, TResult>>
  controls: Omit<StandardModalHandle<TResult, StandardModalOptions<TSurface, TResult>>, keyof Promise<TResult>>
}
export type ModalSlotProps<
  TData extends object,
  TResult = TData | null,
  TSurface = ModalSurfaceOptions
> = ModalActivity & {
  data: Readonly<TData>
  controls: ModalControls<TResult, TData, TSurface>
}
export type ModalDefinition<TData extends object, TResult, TSurface = ModalSurfaceOptions> = {
  open(overrides?: Partial<TData>, options?: { id?: string }): ModalHandle<TResult, TData, TSurface>
}
export type CreateModalOptions<TData extends object, TResult, TSurface> = Omit<
  ModalState<NoInfer<TData>, TSurface, TResult>,
  "data"
> & {
  id?: string
  initialState: TData | (() => TData)
  defaultResult: NoInfer<TResult>
  beforeDismiss?(data: Readonly<NoInfer<TData>>): boolean | Promise<boolean>
}
export type ModalRenderedSlots = { title: ReactNode; body: ReactNode; footer: ReactNode }
export type ModalView<TSurface> = Readonly<
  Omit<ModalOptions<TSurface>, keyof ModalSlots<never>> & {
    renderSlots(activity: ModalActivity): ModalRenderedSlots
    returnFocus?: HTMLElement
  }
>
export type ModalSurfaceProps<TSurface> = ModalRenderedSlots & {
  entry: ModalEntry<ModalView<TSurface>>
  /** Nested modals belong inside the native dialog context. */
  children?: ReactNode
}
export type ModalManager<TSurface> = Pick<
  ModalStore<ModalView<TSurface>>,
  "subscribe" | "getSnapshot" | "getServerSnapshot" | "closeAll" | "clear" | "dispose"
> & {
  readonly adapter?: ModalAdapter<TSurface>
  open(options: OpenModalOptions<TSurface>): StandardModalHandle<void, OpenModalOptions<TSurface>>
  alert(options: OpenModalOptions<TSurface>): StandardModalHandle<void, OpenModalOptions<TSurface>>
  confirm(options: ConfirmModalOptions<TSurface>): StandardModalHandle<boolean, ConfirmModalOptions<TSurface>>
  createModal<TData extends object, TResult = TData | null>(
    options: CreateModalOptions<TData, TResult, TSurface>
  ): ModalDefinition<TData, TResult, TSurface>
}
