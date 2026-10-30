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

/** The path or URL `handleUpload` answers at. */
export function uploadUrl(): string {
  return getBackend("storage")?.uploads?.url ?? defaultUploadUrl
}

/**
 * The secret that signs uploads, from `configureBackends` or the Worker's env. Read only when signing or checking an
 * upload, so apps that never take uploads need none.
 */
export async function uploadSecret(): Promise<string> {
  const configured = getBackend("storage")?.uploads?.secret
  if (configured !== undefined) {
    if (configured === "") {
      throw new Error("The upload secret in configureBackends({ storage: { uploads: { secret } } }) is empty.")
    }
    return configured
  }
  const { cloudflareEnv } = await cloudflareModule()
  const secret = (await cloudflareEnv("Signing uploads"))[uploadSecretBinding]
  if (typeof secret !== "string" || secret === "") {
    throw new Error(
      `Signing uploads needs a secret: set the Worker secret ${uploadSecretBinding}, or pass ` +
        "configureBackends({ storage: { uploads: { secret } } })."
    )
  }
  return secret
}
