import { BetterAppsError } from "better-apps"
import type { ListResult, StoredObject, StoredObjectBody } from "./adapter.js"
import { storageAdapter } from "./backends.js"
import { readAll } from "./bytes.js"
import { atMost, checkKey, exactLength, matchesContentType, tooLarge } from "./limits.js"
import { createUploadUrl, type Upload } from "./uploads.js"

/** Limits a bucket enforces on `put` and uploads. Literals, so the build plugin can read them. */
export interface BucketOptions {
  /** The largest object, in bytes. */
  maxSize?: number | undefined
  /** Content types objects may have, exactly or as `type/*`, such as `["image/*", "application/pdf"]`. */
  contentTypes?: readonly string[] | undefined
}

/** What `put` stores. Byte arrays, strings and blobs have a known size; a stream's comes from the `size` option. */
export type PutBody = ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | Blob | string

/** Options for `put`. */
export interface PutOptions {
  /** The default for a `Blob` is its type. Required when the bucket limits content types. */
  contentType?: string | undefined
  cacheControl?: string | undefined
  /** String metadata stored with the object. */
  metadata?: Record<string, string> | undefined
  /**
   * A stream's size in bytes, when known. The stream must send exactly this many. Without it, some backends, such as
   * R2, read the stream into memory first.
   */
  size?: number | undefined
}

/** Options for `list`. */
export interface ListOptions {
  prefix?: string | undefined
  /** Groups keys up to the next delimiter, such as `/`, into `prefixes`, like folders. */
  delimiter?: string | undefined
  /** From the previous page. */
  cursor?: string | undefined
  /** At most 1000. The default is 1000. */
  limit?: number | undefined
}

/** Options for `serve`. */
export interface ServeOptions {
  /** Sends the file as a download, with the key's last segment or this name as its file name. */
  download?: boolean | string | undefined
  /** Overrides the object's stored `Cache-Control`. */
  cacheControl?: string | undefined
}

/** What the browser will upload, checked against the bucket's limits. */
export interface CreateUploadInput {
  key: string
  contentType: string
  /** The file's size in bytes. The upload must be exactly this size. */
  size: number
}

/** Options for `createUpload`. */
export interface CreateUploadOptions {
  /** Seconds until the URL stops working. The default is 900 (15 minutes). */
  expiresIn?: number | undefined
}

/** A bucket declared with `defineBucket`. It finds its adapter on first use. */
export interface Bucket {
  /** The bucket's identity: renaming it creates a new bucket. */
  readonly name: string
  readonly options: BucketOptions
  /** Stores an object, replacing any at the key. Throws a `BetterAppsError` for a size or type the bucket refuses. */
  put(key: string, body: PutBody, options?: PutOptions): Promise<StoredObject>
  /** Reads an object and its contents, or `null`. */
  get(key: string): Promise<StoredObjectBody | null>
  /** Reads what's known about an object, without its contents, or `null`. */
  head(key: string): Promise<StoredObject | null>
  /** Deletes one object or many. Keys with no object are ignored. */
  delete(keys: string | readonly string[]): Promise<void>
  /** A page of objects, in key order. */
  list(options?: ListOptions): Promise<ListResult>
  /**
   * Answers a request for an object: 200 with its type, length and ETag, 304 when `If-None-Match` matches, or 404.
   * Files are sent with `X-Content-Type-Options: nosniff` and a sandboxing Content Security Policy, so an uploaded
   * HTML or SVG file can't run scripts as the app.
   */
  serve(key: string, request?: Request, options?: ServeOptions): Promise<Response>
  /** Checks the limits and signs a URL the browser uploads one file to, answered by `handleUpload`. */
  createUpload(input: CreateUploadInput, options?: CreateUploadOptions): Promise<Upload>
}

// Bucket names become binding and resource names, so they're kept to what R2 allows.
const bucketName = /^[a-z][a-z0-9-]{0,62}$/
const maxListLimit = 1000
const defaultUploadExpiry = 900
const encoder = new TextEncoder()

function withBody(object: StoredObject, body: ReadableStream<Uint8Array>): StoredObjectBody {
  return {
    ...object,
    body,
    arrayBuffer: async () => (await readAll(body)).buffer as ArrayBuffer,
    text: async () => new TextDecoder().decode(await readAll(body)),
    json: async <T>() => JSON.parse(new TextDecoder().decode(await readAll(body))) as T
  }
}

function toBytes(body: ArrayBuffer | ArrayBufferView | string): Uint8Array {
  if (typeof body === "string") {
    return encoder.encode(body)
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body)
  }
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
}

function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) {
    return false
  }
  return header.split(",").some((tag) => {
    const value = tag.trim()
    return value === "*" || value.replace(/^W\//, "") === `"${etag}"`
  })
}

function contentDisposition(key: string, download: true | string): string {
  const name = download === true ? (key.split("/").at(-1) ?? key) : download
  return `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Declares a bucket for object storage. Declare it at module top level with a literal name, export it, and import the
 * handle wherever it's used (better-apps-deploy.md §2). The adapter comes from `configureBackends`, or is R2 by
 * default, with the binding `STORAGE_<NAME>`.
 */
/*#__NO_SIDE_EFFECTS__*/
export function defineBucket(name: string, options: BucketOptions = {}): Bucket {
  if (!bucketName.test(name)) {
    throw new Error(
      `Bucket names use lowercase letters, digits and hyphens, start with a letter and fit in 63: ${name}`
    )
  }
  const backend = async () => (await storageAdapter()).bucket(name)

  function checkContentType(contentType: string | null): void {
    if (!options.contentTypes) {
      return
    }
    if (contentType === null || !matchesContentType(contentType, options.contentTypes)) {
      throw new BetterAppsError(
        "UNSUPPORTED_MEDIA_TYPE",
        `This bucket takes ${options.contentTypes.join(", ")}, not ${contentType ?? "a file without a type"}.`,
        { status: 415 }
      )
    }
  }

  function checkSize(size: number | undefined): void {
    if (size !== undefined && options.maxSize !== undefined && size > options.maxSize) {
      throw tooLarge(options.maxSize)
    }
  }

  return {
    name,
    options,
    async put(key, body, putOptions = {}) {
      checkKey(key)
      const contentType = putOptions.contentType ?? (body instanceof Blob && body.type !== "" ? body.type : null)
      checkContentType(contentType)
      let data: Uint8Array | ReadableStream<Uint8Array>
      let size: number | undefined
      if (body instanceof ReadableStream) {
        size = putOptions.size
        // A declared size is checked against the limit below, and the stream must match it exactly.
        if (size !== undefined) {
          data = exactLength(body, size)
        } else {
          data = options.maxSize === undefined ? body : atMost(body, options.maxSize)
        }
      } else if (body instanceof Blob) {
        data = options.maxSize === undefined ? body.stream() : atMost(body.stream(), options.maxSize)
        size = body.size
      } else {
        data = toBytes(body)
        size = data.byteLength
      }
      checkSize(size)
      return (await backend()).put(key, data, {
        size,
        contentType,
        cacheControl: putOptions.cacheControl ?? null,
        metadata: { ...putOptions.metadata }
      })
    },
    async get(key) {
      checkKey(key)
      const found = await (await backend()).get(key)
      return found ? withBody(found.object, found.body) : null
    },
    async head(key) {
      checkKey(key)
      return (await backend()).head(key)
    },
    async delete(keys) {
      const list = typeof keys === "string" ? [keys] : [...keys]
      for (const key of list) {
        checkKey(key)
      }
      if (list.length > 0) {
        await (await backend()).delete(list)
      }
    },
    async list(listOptions = {}) {
      const limit = Math.min(Math.max(Math.trunc(listOptions.limit ?? maxListLimit), 1), maxListLimit)
      return (await backend()).list({
        prefix: listOptions.prefix,
        delimiter: listOptions.delimiter,
        cursor: listOptions.cursor,
        limit
      })
    },
    async serve(key, request, serveOptions = {}) {
      const found = await (await backend()).get(key)
      if (!found) {
        return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } })
      }
      const { object, body } = found
      const headers = new Headers({
        etag: `"${object.etag}"`,
        "last-modified": object.uploadedAt.toUTCString(),
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox"
      })
      const cacheControl = serveOptions.cacheControl ?? object.cacheControl
      if (cacheControl !== null) {
        headers.set("cache-control", cacheControl)
      }
      if (etagMatches(request?.headers.get("if-none-match") ?? null, object.etag)) {
        await body.cancel()
        return new Response(null, { status: 304, headers })
      }
      headers.set("content-type", object.contentType ?? "application/octet-stream")
      headers.set("content-length", String(object.size))
      if (serveOptions.download) {
        headers.set("content-disposition", contentDisposition(key, serveOptions.download))
      }
      if (request?.method === "HEAD") {
        await body.cancel()
        return new Response(null, { status: 200, headers })
      }
      return new Response(body, { status: 200, headers })
    },
    async createUpload(input, uploadOptions = {}) {
      checkKey(input.key)
      checkContentType(input.contentType)
      if (!Number.isSafeInteger(input.size) || input.size < 0) {
        throw new BetterAppsError("INVALID_INPUT", "An upload's size is a whole number of bytes.")
      }
      checkSize(input.size)
      return createUploadUrl(
        { bucket: name, key: input.key, contentType: input.contentType, size: input.size },
        uploadOptions.expiresIn ?? defaultUploadExpiry
      )
    }
  }
}
