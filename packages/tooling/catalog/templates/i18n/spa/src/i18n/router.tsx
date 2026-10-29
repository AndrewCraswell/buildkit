import type { AnyRouter } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { browserI18n } from "./browser"
import { createI18n } from "./instance"
import { sourceLocale } from "./locales"
import { followLocale } from "./navigation"
import { LocaleProvider } from "./provider"

interface LocaleWrapProps {
  children: ReactNode
}

/**
 * Gives the router the browser's Lingui instance, which bootstrapLocale() activated before the first render. The
 * prerendered shell renders in the source locale, so keep translated text in routes rather than in the shell.
 */
export function withI18n(router: AnyRouter) {
  const i18n = router.isServer ? createI18n(sourceLocale, {}) : browserI18n
  const { Wrap: Inner } = router.options
  router.options.Wrap = function LocaleWrap({ children }: LocaleWrapProps) {
    return <LocaleProvider i18n={i18n}>{Inner ? <Inner>{children}</Inner> : children}</LocaleProvider>
  }
  if (!router.isServer) {
    followLocale(router, i18n)
  }
}
