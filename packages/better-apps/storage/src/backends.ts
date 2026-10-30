import { getBackend } from "better-apps"
import type { StorageAdapter } from "./adapter.js"

/** Where browsers send uploads, and the secret that signs them. */
export interface UploadOptions {
  /** The path or URL `handleUpload` answers at. The default is `/api/storage/upload`. */
  url?: string | undefined
  /** Signs upload URLs. The default is the Worker secret `STORAGE_UPLOAD_SECRET`. */
  secret?: string | undefined
}

/** Storage's entry in `configureBackends`. */
export interface StorageBackend {
  /** The default is `r2Storage()`, which finds each bucket's R2 binding by its name. */
  adapter?: StorageAdapter | undefined
  uploads?: UploadOptions | undefined
}

declare module "better-apps" {
  interface Backends {
    /** Object storage, for buckets declared with `defineBucket` from `@better-apps/storage`. */
    storage?: StorageBackend | undefined
  }
}

/** The Worker secret that signs uploads when `configureBackends` doesn't set one. */
export const uploadSecretBinding = "STORAGE_UPLOAD_SECRET"
const defaultUploadUrl = "/api/storage/upload"

let cloudflare: Promise<typeof import("./cloudflare.js")> | undefined
let defaultAdapter: StorageAdapter | undefined

// Loaded only when the app hasn't chosen, so apps on other backends never load the Cloudflare adapter.
function cloudflareModule() {
  cloudflare ??= import("./cloudflare.js")
  return cloudflare
}

/** The adapter `configureBackends` chose, or the R2 adapter. */
export async function storageAdapter(): Promise<StorageAdapter> {
  const configured = getBackend("storage")?.adapter
  if (configured) {
    return configured
  }
  const { r2Storage } = await cloudflareModule()
  defaultAdapter ??= r2Storage()
  return defaultAdapter
}

/** The upload URL and signing secret, from `configureBackends` or the Worker's env. */
export async function uploadSettings(): Promise<{ url: string; secret: string }> {
  const uploads = getBackend("storage")?.uploads
  const url = uploads?.url ?? defaultUploadUrl
  if (uploads?.secret !== undefined) {
    return { url, secret: uploads.secret }
  }
  const { cloudflareEnv } = await cloudflareModule()
  const secret = (await cloudflareEnv("Signing uploads"))[uploadSecretBinding]
  if (typeof secret !== "string" || secret === "") {
    throw new Error(
      `Signing uploads needs a secret: set the Worker secret ${uploadSecretBinding}, or pass ` +
        "configureBackends({ storage: { uploads: { secret } } })."
    )
  }
  return { url, secret }
}
