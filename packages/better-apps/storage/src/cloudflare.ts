import type { BucketBackend, ListResult, StorageAdapter, StoredObject } from "./adapter.js"
import { readAll } from "./bytes.js"

/** What R2 reports about an object. The fields of Cloudflare's `R2Object` that the adapter reads. */
export interface R2ObjectLike {
  key: string
  size: number
  etag: string
  uploaded: Date
  httpMetadata?: { contentType?: string | undefined; cacheControl?: string | undefined } | undefined
  customMetadata?: Record<string, string> | undefined
}

/** An R2 object with its contents. */
export interface R2ObjectBodyLike extends R2ObjectLike {
  body: ReadableStream<Uint8Array>
}

/** An R2 bucket binding: the methods of Cloudflare's `R2Bucket` that the adapter calls. */
export interface R2BucketLike {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: {
      httpMetadata?: { contentType?: string | undefined; cacheControl?: string | undefined } | undefined
      customMetadata?: Record<string, string> | undefined
    }
  ): Promise<R2ObjectLike | null>
  get(key: string): Promise<R2ObjectBodyLike | null>
  head(key: string): Promise<R2ObjectLike | null>
  delete(keys: string | string[]): Promise<void>
  list(options?: {
    prefix?: string | undefined
    cursor?: string | undefined
    delimiter?: string | undefined
    limit?: number | undefined
    include?: ("httpMetadata" | "customMetadata")[] | undefined
  }): Promise<{ objects: R2ObjectLike[]; truncated: boolean; cursor?: string | undefined; delimitedPrefixes: string[] }>
}

/** Options for `r2Storage`. */
export interface R2StorageOptions {
  /**
   * R2 bindings by bucket name, for buckets whose binding isn't the derived name, such as
   * `{ avatars: env.MY_BUCKET }`. Other buckets read the binding `STORAGE_<NAME>` from `cloudflare:workers`.
   */
  buckets?: Record<string, R2BucketLike> | undefined
}

// R2 deletes at most 1000 keys per call.
const deleteBatch = 1000

/** The env binding a bucket uses by default: `avatars` reads `STORAGE_AVATARS`. */
export function storageBindingName(bucket: string): string {
  return `STORAGE_${bucket.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_")}`
}

/** The Worker's env, through `cloudflare:workers`. Fails with a hint off Cloudflare, such as in Node tests. */
export async function cloudflareEnv(task: string): Promise<Record<string, unknown>> {
  try {
    const { env } = await import("cloudflare:workers")
    return env
  } catch (cause) {
    throw new Error(
      `${task} defaults to Cloudflare, but cloudflare:workers isn't available here. Choose another adapter with ` +
        "configureBackends from better-apps, such as memoryStorage() from @better-apps/storage/local.",
      { cause }
    )
  }
}

function toStoredObject(object: R2ObjectLike): StoredObject {
  return {
    key: object.key,
    size: object.size,
    etag: object.etag,
    contentType: object.httpMetadata?.contentType ?? null,
    cacheControl: object.httpMetadata?.cacheControl ?? null,
    metadata: { ...object.customMetadata },
    uploadedAt: object.uploaded
  }
}

interface FixedLengthStreamConstructor {
  new (length: number): { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
}

/**
 * R2 needs a stream's length up front. Workers' `FixedLengthStream` gives a stream of known size one; elsewhere, such as
 * through Miniflare from Node, the body is read into memory.
 */
async function r2Body(
  body: Uint8Array | ReadableStream<Uint8Array>,
  size: number | undefined
): Promise<{ value: ReadableStream<Uint8Array> | Uint8Array; piped: Promise<unknown> }> {
  if (body instanceof Uint8Array) {
    return { value: body, piped: Promise.resolve() }
  }
  if (size === 0) {
    return { value: await readAll(body), piped: Promise.resolve() }
  }
  const FixedLengthStream = (globalThis as { FixedLengthStream?: FixedLengthStreamConstructor }).FixedLengthStream
  if (FixedLengthStream && size !== undefined) {
    const fixed = new FixedLengthStream(size)
    return {
      value: fixed.readable,
      piped: body.pipeTo(fixed.writable).then(
        () => undefined,
        (error: unknown) => error
      )
    }
  }
  return { value: await readAll(body), piped: Promise.resolve() }
}

function r2Bucket(binding: () => Promise<R2BucketLike>): BucketBackend {
  return {
    async put(key, body, options) {
      const bucket = await binding()
      const { value, piped } = await r2Body(body, options.size)
      let stored: R2ObjectLike | null
      try {
        stored = await bucket.put(key, value, {
          httpMetadata: {
            ...(options.contentType === null ? {} : { contentType: options.contentType }),
            ...(options.cacheControl === null ? {} : { cacheControl: options.cacheControl })
          },
          customMetadata: options.metadata
        })
      } catch (error) {
        // A body that broke a limit errors the stream R2 reads; report the limit, not R2's stream error.
        throw (await piped) ?? error
      }
      if (!stored) {
        throw new Error(`R2 didn't store ${key}.`)
      }
      return toStoredObject(stored)
    },
    async get(key) {
      const object = await (await binding()).get(key)
      return object ? { object: toStoredObject(object), body: object.body } : null
    },
    async head(key) {
      const object = await (await binding()).head(key)
      return object ? toStoredObject(object) : null
    },
    async delete(keys) {
      const bucket = await binding()
      for (let start = 0; start < keys.length; start += deleteBatch) {
        await bucket.delete(keys.slice(start, start + deleteBatch))
      }
    },
    async list(options): Promise<ListResult> {
      const page = await (
        await binding()
      ).list({
        prefix: options.prefix,
        delimiter: options.delimiter,
        cursor: options.cursor,
        limit: options.limit,
        include: ["httpMetadata", "customMetadata"]
      })
      return {
        objects: page.objects.map(toStoredObject),
        prefixes: page.delimitedPrefixes,
        cursor: page.truncated ? page.cursor : undefined
      }
    }
  }
}

/**
 * Stores buckets in Cloudflare R2 through Worker bindings. It's the default adapter: each bucket reads the binding
 * `STORAGE_<NAME>` from `cloudflare:workers`, unless `buckets` passes one.
 */
export function r2Storage(options: R2StorageOptions = {}): StorageAdapter {
  return {
    bucket(name) {
      const given = options.buckets?.[name]
      return r2Bucket(async () => {
        if (given) {
          return given
        }
        const bindingName = storageBindingName(name)
        const binding = (await cloudflareEnv(`Bucket "${name}"`))[bindingName]
        if (!binding) {
          throw new Error(
            `Bucket "${name}" has no R2 binding ${bindingName}. Bind one in the Worker's config, pass it to ` +
              "r2Storage({ buckets }), or choose another adapter with configureBackends from better-apps."
          )
        }
        return binding as R2BucketLike
      })
    }
  }
}
