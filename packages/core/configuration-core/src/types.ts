/** Persist only explicit overrides under an application-owned namespace. */
export type ConfigurationOverrideStorage = { storage: "localStorage" | "sessionStorage"; key: string }

/** Supported scalar settings: boolean switches, string variants, and numeric values. */
export type SettingValue = boolean | string | number
export type SettingValues = Record<string, SettingValue>
export type SettingKey<T> = Extract<keyof T, string>
export type SettingSource = "default" | "provider" | "override"
export type SettingState<T> = Readonly<{
  value: T
  defaultValue: T
  source: SettingSource
}>
export type ConfigurationStatus = "idle" | "loading" | "ready" | "error"

/**
 * Adapter boundary for application-defined targeting context and evaluated settings.
 * Each load returns a complete evaluation; omitted keys use defaults.
 * Adapters own SDK initialization, context isolation, and exposure tracking.
 */
export type ConfigurationProvider<T extends object, Context extends object> = {
  load(context: Readonly<Context>, options: { signal: AbortSignal }): Partial<T> | Promise<Partial<T>>
  /** Optional invalidation signal. Return a function that removes this client's listener. */
  subscribe?(onChange: () => void): () => void
}
export type ConfigurationOptions<T extends object, Context extends object> = {
  defaults: T
  context: Context
  provider?: ConfigurationProvider<NoInfer<T>, NoInfer<Context>>
  /** Disabled by default. true enables memory overrides; storage requires a namespace key. */
  overrides?: boolean | ConfigurationOverrideStorage
  /** Additional validation, e.g. enum membership or numeric limits. No schema library required. */
  validate?: Partial<{ [K in keyof T]: (value: T[K]) => boolean }>
}
export type ConfigurationSnapshot<T extends object, Context extends object> = Readonly<{
  values: Readonly<T>
  context: Readonly<Context>
  status: ConfigurationStatus
  error: Error | undefined
}>
export type ConfigurationClient<T extends object, Context extends object> = {
  get<K extends SettingKey<T>>(key: K): T[K]
  getSetting<K extends SettingKey<T>>(key: K): SettingState<T[K]>
  getServerSetting<K extends SettingKey<T>>(key: K): SettingState<T[K]>
  getSnapshot(): ConfigurationSnapshot<T, Context>
  getServerSnapshot(): ConfigurationSnapshot<T, Context>
  subscribe(listener: () => void): () => void
  /** Starts or refreshes evaluation. Provider errors are exposed through the snapshot. */
  refresh(): Promise<void>
  /** Replaces the context and clears previous provider values before evaluating again. */
  setContext(context: Context): Promise<void>
  override<K extends SettingKey<T>>(key: K, value: NoInfer<T[K]>): void
  reset<K extends SettingKey<T>>(key: K): void
  resetAll(): void
  /** Aborts work and disconnects subscriptions. Does not dispose a shared provider SDK. */
  dispose(): void
}
