import type { ModalActivity, ModalEntry, ModalStore } from "@buildkitgg/modal-core"
import type { ComponentType, CSSProperties, ReactNode } from "react"

export type ModalLabels = { confirm: ReactNode; cancel: ReactNode; close: ReactNode }
export type ModalManagerOptions<TSurface = ModalSurfaceOptions> = {
  labels?: Partial<ModalLabels>
  adapter?: ModalAdapter<TSurface>
}
/** A renderer binding selected once when creating a manager. */
export type ModalAdapter<TSurface = ModalSurfaceOptions> = Readonly<{
  Surface: ComponentType<ModalSurfaceProps<TSurface>>
}>
/** Styling shared by every UI adapter. Native dialog behavior belongs to the renderer. */
export type ModalSurfaceOptions = { className?: string; style?: CSSProperties }
export type ModalOptions<TSurface> = {
  id?: string
  title: ReactNode
  description?: ReactNode
  surfaceProps?: TSurface
  dismissible?: boolean
}
export type OpenModalOptions<TSurface> = ModalOptions<TSurface> & { children?: ReactNode; closeLabel?: ReactNode }
export type ConfirmModalOptions<TSurface> = OpenModalOptions<TSurface> & {
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
}
export type ModalStateUpdate<TData extends object> = Partial<TData> | ((current: Readonly<TData>) => Partial<TData>)
export type ModalControls<TResult, TData extends object> = {
  readonly id: string
  close(result: TResult): void
  dismiss(): Promise<boolean>
  submit(action: (data: Readonly<TData>) => TResult | Promise<TResult>): Promise<boolean>
  update(patch: ModalStateUpdate<TData>): void
  isActive(): boolean
}
export type ModalHandle<TResult, TData extends object> = Promise<TResult> & ModalControls<TResult, TData>
export type ModalBodyProps<TData extends object, TResult = TData | null> = ModalActivity & {
  data: Readonly<TData>
  controls: ModalControls<TResult, TData>
}
export type ModalDefinition<TData extends object, TResult> = {
  open(overrides?: Partial<TData>, options?: { id?: string }): ModalHandle<TResult, TData>
}
export type CreateModalOptions<TData extends object, TResult, TSurface> = ModalOptions<TSurface> & {
  /** Use a factory for independently allocated nested values on each opening. */
  initialState: TData | (() => TData)
  /** A React component, rendered with normal hook and reconciliation semantics. */
  render: ComponentType<ModalBodyProps<NoInfer<TData>, TResult>>
  /** Does not narrow the successful result type. */
  defaultResult: NoInfer<TResult>
  beforeDismiss?(data: Readonly<NoInfer<TData>>): boolean | Promise<boolean>
}
export type ModalAction = Readonly<{ label: ReactNode; appearance: "primary" | "secondary"; onClick(): void }>
export type ModalView<TSurface> = Readonly<
  ModalOptions<TSurface> & {
    renderBody(activity: ModalActivity): ReactNode
    actions: readonly ModalAction[]
    returnFocus?: HTMLElement
  }
>
export type ModalSurfaceProps<TSurface> = {
  entry: ModalEntry<ModalView<TSurface>>
  body: ReactNode
  /** Render descendants within the native dialog context so focus and Escape follow the stack. */
  children?: ReactNode
}
export type ModalManager<TSurface> = Pick<
  ModalStore<ModalView<TSurface>>,
  "subscribe" | "getSnapshot" | "getServerSnapshot" | "closeAll" | "clear" | "dispose"
> & {
  readonly adapter?: ModalAdapter<TSurface>
  open(options: OpenModalOptions<TSurface>): ModalHandle<void, OpenModalOptions<TSurface>>
  alert(options: OpenModalOptions<TSurface>): ModalHandle<void, OpenModalOptions<TSurface>>
  confirm(options: ConfirmModalOptions<TSurface>): ModalHandle<boolean, ConfirmModalOptions<TSurface>>
  createModal<TData extends object, TResult = TData | null>(
    options: CreateModalOptions<TData, TResult, TSurface>
  ): ModalDefinition<TData, TResult>
}
