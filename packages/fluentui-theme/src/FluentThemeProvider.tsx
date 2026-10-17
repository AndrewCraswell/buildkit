"use client"

import { useTheme } from "@buildkitgg/react-theme"
import { FluentProvider, type FluentProviderProps } from "@fluentui/react-components"
import { useEffect } from "react"
import type { FluentThemeStore } from "./createFluentTheme.js"

export type FluentThemeProviderProps = Omit<FluentProviderProps, "theme"> & { store: FluentThemeStore }

/** Retains Fluent's native context and portal support; selection lives in the external store. */
export function FluentThemeProvider({ store, ...props }: FluentThemeProviderProps) {
  const { resolvedTheme } = useTheme(store)
  useEffect(() => store.start(), [store])
  return <FluentProvider {...props} theme={store.themes[resolvedTheme]} />
}
