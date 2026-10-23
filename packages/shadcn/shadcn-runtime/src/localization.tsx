"use client"

import { DirectionProvider } from "@base-ui/react/direction-provider"
import { createContext, useContext } from "react"
import type { ReactNode } from "react"

export type ShadcnStrings = {
  close: string
  toggleSidebar: string
  sidebar: string
  sidebarDescription: string
  showOptions: string
  clear: string
  remove: string
  removeItem: (label: string) => string
  loading: string
  commandPalette: string
  commandDescription: string
  breadcrumb: string
  pagination: string
  previousPage: string
  nextPage: string
  previous: string
  next: string
  morePages: string
  more: string
  previousSlide: string
  nextSlide: string
  carousel: string
  slide: string
  closeToast: string
  copy: string
  copied: string
  confirm: string
  cancel: string
  notifications: string
  dismiss: string
}

export const defaultShadcnStrings: Readonly<ShadcnStrings> = Object.freeze({
  close: "Close",
  toggleSidebar: "Toggle Sidebar",
  sidebar: "Sidebar",
  sidebarDescription: "Displays the mobile sidebar.",
  showOptions: "Show options",
  clear: "Clear",
  remove: "Remove",
  removeItem: (label: string) => `Remove ${label}`,
  loading: "Loading",
  commandPalette: "Command Palette",
  commandDescription: "Search for a command to run...",
  breadcrumb: "breadcrumb",
  pagination: "pagination",
  previousPage: "Go to previous page",
  nextPage: "Go to next page",
  previous: "Previous",
  next: "Next",
  morePages: "More pages",
  more: "More",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  carousel: "carousel",
  slide: "slide",
  closeToast: "Close toast",
  copy: "Copy",
  copied: "Copied",
  confirm: "Confirm",
  cancel: "Cancel",
  notifications: "Notifications",
  dismiss: "Dismiss"
})

export type ShadcnLocalization = {
  readonly strings: Readonly<ShadcnStrings>
  readonly direction: "ltr" | "rtl"
}

const LocalizationContext = createContext<ShadcnLocalization>({ strings: defaultShadcnStrings, direction: "ltr" })

export type ShadcnLocalizationProviderProps = {
  strings?: Partial<ShadcnStrings>
  direction?: "ltr" | "rtl"
  children?: ReactNode
}

/** Nested providers inherit unspecified strings. Updates apply to mounted components and portals. */
export function ShadcnLocalizationProvider({ strings, direction, children }: ShadcnLocalizationProviderProps) {
  const parent = useShadcnLocalization()
  const resolved = { ...parent.strings }
  for (const key of Object.keys(parent.strings)) {
    const value = Reflect.get(strings ?? {}, key)
    if (value !== undefined) {
      Reflect.set(resolved, key, value)
    }
  }
  const localization: ShadcnLocalization = {
    strings: Object.freeze(resolved),
    direction: direction ?? parent.direction
  }
  return (
    <LocalizationContext value={localization}>
      <DirectionProvider direction={localization.direction}>{children}</DirectionProvider>
    </LocalizationContext>
  )
}

export function useShadcnLocalization(): ShadcnLocalization {
  return useContext(LocalizationContext)
}
