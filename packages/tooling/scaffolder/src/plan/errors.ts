import type { ErrorCode, PlanErrorInfo } from "./types.js"

const retryableCodes = new Set<ErrorCode>(["E_DRIFT", "E_LOCKED", "E_INTERRUPTED"])

/** A structured failure. The planner throws it internally and returns it as the plan's `error`. */
export class PlanError extends Error {
  readonly code: ErrorCode
  readonly paths: string[] | undefined
  readonly next: string[] | undefined

  constructor(code: ErrorCode, message: string, details: { paths?: string[]; next?: string[] } = {}) {
    super(message)
    this.name = "PlanError"
    this.code = code
    this.paths = details.paths
    this.next = details.next
  }

  toInfo(): PlanErrorInfo {
    return {
      code: this.code,
      message: this.message,
      retryable: retryableCodes.has(this.code),
      ...(this.paths ? { paths: this.paths } : {}),
      ...(this.next ? { next: this.next } : {})
    }
  }
}

export function errorInfo(error: unknown): PlanErrorInfo {
  if (error instanceof PlanError) {
    return error.toInfo()
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: "E_INTERNAL", message, retryable: false }
}
