import { createAlertStore } from "@buildkitgg/alert-core"
import type { ReactNode } from "react"
import type { AlertManager, AlertManagerOptions } from "./types.js"
export function createAlertManager(options: AlertManagerOptions = {}): AlertManager {
  return Object.freeze({ ...createAlertStore<ReactNode>(), adapter: options.adapter })
}
