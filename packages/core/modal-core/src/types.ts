export type ModalStatus = "open" | "closing"
export type ModalActivity = Readonly<{ isPending: boolean; error: unknown }>

export type ModalControls<TResult, TContent> = {
  readonly id: string
  readonly key: number
  /** Complete immediately. Explicit completion bypasses dismissal guards. */
  close(result: TResult): void
  /** Request cancellation. Resolves false when blocked, failed, or no longer active. */
  dismiss(): Promise<boolean>
  /** Run one action at a time; close on success and retain errors for retry. */
  submit(action: () => TResult | Promise<TResult>): Promise<boolean>
  update(updater: (content: TContent) => TContent): void
  isActive(): boolean
}

export type ModalHandle<TResult, TContent> = Promise<TResult> & ModalControls<TResult, TContent>

export type ModalEntry<TContent> = Readonly<
  ModalActivity & {
    id: string
    key: number
    parentKey: number | null
    status: ModalStatus
    content: TContent
    dismiss(): Promise<boolean>
    finishExit(): void
  }
>

export type ModalOpenOptions<TResult, TContent> = {
  id?: string
  defaultResult: TResult
  beforeDismiss?(): boolean | Promise<boolean>
  createContent(controls: ModalControls<TResult, TContent>): TContent
}

export type ModalStore<TContent> = {
  open<TResult>(options: ModalOpenOptions<TResult, TContent>): ModalHandle<TResult, TContent>
  getSnapshot(): readonly ModalEntry<TContent>[]
  getServerSnapshot(): readonly ModalEntry<TContent>[]
  subscribe(listener: () => void): () => void
  /** Force settlement, bypassing pending actions and guards. Retains entries for exit. */
  closeAll(): void
  /** Force settlement and remove entries immediately. */
  clear(): void
  dispose(): void
}
