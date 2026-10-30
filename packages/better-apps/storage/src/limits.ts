import { BetterAppsError } from "better-apps"

// R2 and S3 allow keys of up to 1024 bytes.
const maxKeyBytes = 1024
const encoder = new TextEncoder()

/** Rejects keys R2 and S3 wouldn't store. */
export function checkKey(key: string): void {
  if (key === "" || encoder.encode(key).byteLength > maxKeyBytes) {
    throw new BetterAppsError("INVALID_INPUT", `Object keys need 1 to ${maxKeyBytes} bytes.`)
  }
}

/** The error for a body over a size limit. */
export function tooLarge(maxSize: number): BetterAppsError {
  return new BetterAppsError("LIMIT_EXCEEDED", `Objects in this bucket can be at most ${maxSize} bytes.`, {
    status: 413
  })
}

/** Whether a content type, ignoring parameters such as `charset`, matches `image/png` or `image/*` patterns. */
export function matchesContentType(contentType: string, patterns: readonly string[]): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? ""
  return patterns.some((pattern) => {
    const wanted = pattern.toLowerCase()
    return wanted.endsWith("/*") ? type.startsWith(wanted.slice(0, -1)) : type === wanted
  })
}

/** Passes a stream through, erroring once it has sent more than `maxSize` bytes. */
export function atMost(body: ReadableStream<Uint8Array>, maxSize: number): ReadableStream<Uint8Array> {
  let total = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        if (total > maxSize) {
          controller.error(tooLarge(maxSize))
          return
        }
        controller.enqueue(chunk)
      }
    })
  )
}

/**
 * Passes a stream through, erroring unless it sends exactly `size` bytes. It holds each chunk back until the next one
 * arrives or the stream ends, so a body that runs over errors before the backend has every byte. R2 stores an object as
 * soon as it has the length it was promised, and a later error wouldn't undo that.
 */
export function exactLength(body: ReadableStream<Uint8Array>, size: number): ReadableStream<Uint8Array> {
  let total = 0
  let held: Uint8Array | undefined
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength
        if (total > size) {
          controller.error(tooLarge(size))
          return
        }
        if (held) {
          controller.enqueue(held)
        }
        held = chunk
      },
      flush(controller) {
        if (total !== size) {
          controller.error(new BetterAppsError("INVALID_INPUT", `The upload must be exactly ${size} bytes.`))
          return
        }
        if (held) {
          controller.enqueue(held)
        }
      }
    })
  )
}
