import { cn as defaultCn } from "cn"
import type { ClassValue, CnFunction } from "cn"

let mergeClasses = defaultCn

/** Configure once before rendering, identically on the server and client. Omit input to restore defaults. */
export function setCn(implementation?: CnFunction): void {
  if (implementation === cn) {
    throw new TypeError("setCn requires your own merger, not the kit's delegating cn")
  }
  mergeClasses = implementation ?? defaultCn
}

/** All generated components use this shared merger, including imports captured before configuration. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(...inputs)
}

export type { ClassValue, CnFunction }
