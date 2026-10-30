/** What a bucket knows about a stored object, without its contents. */
export interface StoredObject {
  key: string
  /** The size in bytes. */
  size: number
  /** Changes whenever the contents change. Unquoted; `serve` sends it quoted as the `ETag`. */
  etag: string
  contentType: string | null
  cacheControl: string | null
  /** The string metadata given to `put`. */
  metadata: Record<string, string>
  uploadedAt: Date
}

/** A stored object with its contents, which can be read once. */
export interface StoredObjectBody extends StoredObject {
  body: ReadableStream<Uint8Array>
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
}

/** A page of a bucket's objects, in key order. */
export interface ListResult {
  objects: StoredObject[]
  /** With a `delimiter`, the key prefixes up to the next delimiter that the page groups together, like folders. */
  prefixes: string[]
  /** Passed back to `list` for the next page, or `undefined` on the last one. */
  cursor: string | undefined
}

/** What an adapter's `put` receives once the bucket has checked its limits. */
export interface AdapterPutOptions {
  /** The body's size in bytes, when it's known before the body is read. Always known for byte arrays. */
  size: number | undefined
  contentType: string | null
  cacheControl: string | null
  metadata: Record<string, string>
}

/** What an adapter's `list` receives, with the limit already clamped to 1 to 1000. */
export interface AdapterListOptions {
  prefix: string | undefined
  delimiter: string | undefined
  cursor: string | undefined
  limit: number
}

/** One bucket on a backend. Buckets check limits and keys before calling it. */
export interface BucketBackend {
  /** Stores an object, replacing any at the key. A stream errors if the bucket's size limit is passed. */
  put(key: string, body: Uint8Array | ReadableStream<Uint8Array>, options: AdapterPutOptions): Promise<StoredObject>
  /** Reads an object and its contents, or `null`. */
  get(key: string): Promise<{ object: StoredObject; body: ReadableStream<Uint8Array> } | null>
  /** Reads what's known about an object, or `null`. */
  head(key: string): Promise<StoredObject | null>
  /** Deletes objects. Keys with no object are ignored. */
  delete(keys: readonly string[]): Promise<void>
  list(options: AdapterListOptions): Promise<ListResult>
}

/**
 * Stores buckets on a backend, such as R2 (`r2Storage`), memory or the filesystem (`memoryStorage` and `fileStorage`).
 * Another provider implements this interface and is passed to `configureBackends`.
 */
export interface StorageAdapter {
  /** The backend for the bucket declared with this name. */
  bucket(name: string): BucketBackend
}
