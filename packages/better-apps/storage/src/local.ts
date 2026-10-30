import type {
  AdapterListOptions,
  AdapterPutOptions,
  BucketBackend,
  ListResult,
  StorageAdapter,
  StoredObject
} from "./adapter.js"
import { readAll } from "./bytes.js"

// Sorts after every key that starts with a prefix, so a page's cursor can skip a whole group.
const afterPrefix = "￿"

async function readBytes(body: Uint8Array | ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return body instanceof Uint8Array ? body.slice() : readAll(body)
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Blob([bytes as Uint8Array<ArrayBuffer>]).stream()
}

async function etagOf(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>))
  return Array.from(digest.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function storedObject(key: string, bytes: Uint8Array, options: AdapterPutOptions): Promise<StoredObject> {
  return {
    key,
    size: bytes.byteLength,
    etag: await etagOf(bytes),
    contentType: options.contentType,
    cacheControl: options.cacheControl,
    metadata: { ...options.metadata },
    uploadedAt: new Date()
  }
}

function copyObject(object: StoredObject): StoredObject {
  return { ...object, metadata: { ...object.metadata }, uploadedAt: new Date(object.uploadedAt) }
}

/** Pages through objects sorted by key, the way R2 and S3 do, with folder-like prefixes for a delimiter. */
function listSorted(sorted: readonly StoredObject[], options: AdapterListOptions): ListResult {
  const prefix = options.prefix ?? ""
  const objects: StoredObject[] = []
  const prefixes: string[] = []
  let last: string | undefined
  for (const object of sorted) {
    if ((options.cursor !== undefined && object.key <= options.cursor) || !object.key.startsWith(prefix)) {
      continue
    }
    const rest = object.key.slice(prefix.length)
    const at = options.delimiter ? rest.indexOf(options.delimiter) : -1
    const group = at === -1 ? undefined : prefix + rest.slice(0, at + (options.delimiter?.length ?? 0))
    if (group !== undefined && group === prefixes.at(-1)) {
      continue
    }
    if (objects.length + prefixes.length === options.limit) {
      return { objects, prefixes, cursor: last }
    }
    if (group === undefined) {
      objects.push(copyObject(object))
      last = object.key
    } else {
      prefixes.push(group)
      last = group + afterPrefix
    }
  }
  return { objects, prefixes, cursor: undefined }
}

function byKey(a: StoredObject, b: StoredObject): number {
  if (a.key === b.key) {
    return 0
  }
  return a.key < b.key ? -1 : 1
}

interface MemoryEntry {
  object: StoredObject
  bytes: Uint8Array
}

/**
 * Keeps buckets in memory, for tests and quick local runs. Everything is lost when the process ends, and each call
 * makes a separate store.
 */
export function memoryStorage(): StorageAdapter {
  const buckets = new Map<string, Map<string, MemoryEntry>>()
  return {
    bucket(name): BucketBackend {
      let entries = buckets.get(name)
      if (!entries) {
        entries = new Map()
        buckets.set(name, entries)
      }
      const store = entries
      return {
        async put(key, body, options) {
          const bytes = await readBytes(body)
          const object = await storedObject(key, bytes, options)
          store.set(key, { object, bytes })
          return copyObject(object)
        },
        async get(key) {
          const entry = store.get(key)
          return entry ? { object: copyObject(entry.object), body: streamOf(entry.bytes) } : null
        },
        async head(key) {
          const entry = store.get(key)
          return entry ? copyObject(entry.object) : null
        },
        async delete(keys) {
          for (const key of keys) {
            store.delete(key)
          }
        },
        async list(options) {
          return listSorted(Array.from(store.values(), (entry) => entry.object).sort(byKey), options)
        }
      }
    }
  }
}

/** Options for `fileStorage`. */
export interface FileStorageOptions {
  /** The folder that holds every bucket, such as `.better-apps/storage`. Each bucket gets a folder inside it. */
  directory: string
}

interface StoredFile extends Omit<StoredObject, "uploadedAt"> {
  uploadedAt: string
}

/**
 * Keeps buckets in a folder on Node's filesystem, for local development without Cloudflare's runtime. Files are named
 * by a hash of their key, so any key works on any filesystem; a JSON file beside each holds its key and metadata.
 */
export function fileStorage(options: FileStorageOptions): StorageAdapter {
  return {
    bucket(name): BucketBackend {
      const files = async () => {
        const [fs, path, crypto] = await Promise.all([
          import("node:fs/promises"),
          import("node:path"),
          import("node:crypto")
        ])
        const root = path.resolve(options.directory, name)
        const dataDir = path.join(root, "data")
        const metaDir = path.join(root, "meta")
        const id = (key: string) => crypto.createHash("sha256").update(key).digest("hex")
        const readMeta = async (file: string): Promise<StoredObject | null> => {
          try {
            const stored = JSON.parse(await fs.readFile(file, "utf8")) as StoredFile
            return { ...stored, uploadedAt: new Date(stored.uploadedAt) }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              return null
            }
            throw error
          }
        }
        return {
          fs,
          dataFile: (key: string) => path.join(dataDir, id(key)),
          metaFile: (key: string) => path.join(metaDir, `${id(key)}.json`),
          dataDir,
          metaDir,
          readMeta,
          async all(): Promise<StoredObject[]> {
            const names = await fs.readdir(metaDir).catch((error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") {
                return []
              }
              throw error
            })
            const objects = await Promise.all(names.map(async (file) => readMeta(path.join(metaDir, file))))
            return objects.filter((object) => object !== null).sort(byKey)
          }
        }
      }
      return {
        async put(key, body, putOptions) {
          const store = await files()
          const bytes = await readBytes(body)
          const object = await storedObject(key, bytes, putOptions)
          await store.fs.mkdir(store.dataDir, { recursive: true })
          await store.fs.mkdir(store.metaDir, { recursive: true })
          await store.fs.writeFile(store.dataFile(key), bytes)
          const stored: StoredFile = { ...object, uploadedAt: object.uploadedAt.toISOString() }
          await store.fs.writeFile(store.metaFile(key), JSON.stringify(stored))
          return object
        },
        async get(key) {
          const store = await files()
          const object = await store.readMeta(store.metaFile(key))
          if (!object) {
            return null
          }
          return { object, body: streamOf(await store.fs.readFile(store.dataFile(key))) }
        },
        async head(key) {
          const store = await files()
          return store.readMeta(store.metaFile(key))
        },
        async delete(keys) {
          const store = await files()
          for (const key of keys) {
            await store.fs.rm(store.metaFile(key), { force: true })
            await store.fs.rm(store.dataFile(key), { force: true })
          }
        },
        async list(listOptions) {
          return listSorted(await (await files()).all(), listOptions)
        }
      }
    }
  }
}
