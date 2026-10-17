"use client"

import type { ModalEntry } from "@buildkitgg/modal-core"
import { useEffect, useRef } from "react"

/** A modal opened and closed in one React batch never runs the UI library's exit animation. */
export function useModalExit<TContent>(entry: ModalEntry<TContent>): void {
  const hasOpened = useRef(false)
  useEffect(() => {
    if (entry.status === "open") {
      hasOpened.current = true
    } else if (!hasOpened.current) {
      entry.finishExit()
    }
  }, [entry])
}
