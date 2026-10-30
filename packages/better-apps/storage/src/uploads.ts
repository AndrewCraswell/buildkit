import { BetterAppsError } from "better-apps"
import type { StoredObject } from "./adapter.js"
import { storageAdapter, uploadSecret, uploadUrl } from "./backends.js"
import { exactLength } from "./limits.js"

/** What a signed upload URL allows: one object, of one type and size, until it expires. */
interface UploadGrant {
  bucket: string
  key: string
  contentType: string
  size: number
  /** Seconds since the epoch. */
  expiresAt: number
}

/** Where and how the browser sends a file, from `bucket.createUpload`. */
export interface Upload {
  url: string
  method: "PUT"
  /** Headers the request must send. The browser adds `Content-Length` itself. */
  headers: Record<string, string>
  expiresAt: Date
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const keys = new Map<string, Promise<CryptoKey>>()

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function signingKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify"
    ])
    keys.set(secret, key)
  }
  return key
}

async function sign(grant: UploadGrant, secret: string): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify(grant)))
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(payload))
  return `${payload}.${base64url(new Uint8Array(signature))}`
}

async function verify(token: string, secret: string, now: Date): Promise<UploadGrant | null> {
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra !== undefined) {
    return null
  }
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(secret),
      fromBase64url(signature),
      encoder.encode(payload)
    )
    if (!valid) {
      return null
    }
    const grant = JSON.parse(decoder.decode(fromBase64url(payload))) as UploadGrant
    return grant.expiresAt * 1000 > now.getTime() ? grant : null
  } catch {
    // Text that isn't base64url or JSON is a forged token.
    return null
  }
}

/** Signs an upload URL for checks a bucket has already made. */
export async function createUploadUrl(grant: Omit<UploadGrant, "expiresAt">, expiresIn: number): Promise<Upload> {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
  const token = await sign({ ...grant, expiresAt }, await uploadSecret())
  return {
    url: `${uploadUrl().replace(/\/+$/, "")}/${token}`,
    method: "PUT",
    headers: { "content-type": grant.contentType },
    expiresAt: new Date(expiresAt * 1000)
  }
}

function errorResponse(error: BetterAppsError): Response {
  return Response.json({ code: error.code, message: error.message }, { status: error.status })
}

function mediaType(header: string | null): string | undefined {
  return header?.split(";")[0]?.trim().toLowerCase()
}

/**
 * Answers uploads from URLs that `bucket.createUpload` signed, and returns `null` for any other request, so it can run
 * before the app's other handlers. It checks the signature, expiry, `Content-Type` and `Content-Length`, then streams
 * the body into the bucket, stopping if it runs past the signed size. It answers `201` with the stored object.
 */
export async function handleUpload(request: Request): Promise<Response | null> {
  const requestUrl = new URL(request.url)
  const base = `${new URL(uploadUrl(), requestUrl).pathname.replace(/\/+$/, "")}/`
  if (!requestUrl.pathname.startsWith(base)) {
    return null
  }
  if (request.method !== "PUT") {
    return new Response(null, { status: 405, headers: { allow: "PUT" } })
  }
  const grant = await verify(requestUrl.pathname.slice(base.length), await uploadSecret(), new Date())
  if (!grant) {
    return errorResponse(new BetterAppsError("FORBIDDEN", "This upload URL isn't valid or has expired."))
  }
  if (mediaType(request.headers.get("content-type")) !== mediaType(grant.contentType)) {
    return errorResponse(
      new BetterAppsError("UNSUPPORTED_MEDIA_TYPE", `The upload must be sent as ${grant.contentType}.`, { status: 415 })
    )
  }
  const length = request.headers.get("content-length")
  if (length === null) {
    return errorResponse(new BetterAppsError("LENGTH_REQUIRED", "The upload needs a Content-Length.", { status: 411 }))
  }
  // An empty upload has no body to read.
  const body = request.body ?? (grant.size === 0 ? new Blob([]).stream() : null)
  if (Number(length) !== grant.size || !body) {
    return errorResponse(new BetterAppsError("INVALID_INPUT", `The upload must be exactly ${grant.size} bytes.`))
  }
  let object: StoredObject
  try {
    object = await (await storageAdapter()).bucket(grant.bucket).put(grant.key, exactLength(body, grant.size), {
      size: grant.size,
      contentType: grant.contentType,
      cacheControl: null,
      metadata: {}
    })
  } catch (error) {
    if (error instanceof BetterAppsError) {
      return errorResponse(error)
    }
    throw error
  }
  return Response.json(
    {
      key: object.key,
      size: object.size,
      etag: object.etag,
      contentType: object.contentType,
      uploadedAt: object.uploadedAt.toISOString()
    },
    { status: 201 }
  )
}
