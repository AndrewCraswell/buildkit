import { I18n, type Messages } from "@lingui/core"
import type { AnyRouter } from "@tanstack/react-router"
import { getGlobalStartContext } from "@tanstack/react-start"
import type { ReactNode } from "react"
import { createI18n } from "./instance"
import { sourceLocale } from "./locales"
import { isLocale } from "./match"
import { followLocale } from "./navigation"
import { LocaleProvider } from "./provider"

/** The instance the locale middleware created for this request. Only the server has one. */
function requestI18n(): I18n | undefined {
  try {
    const context: unknown = getGlobalStartContext()
    if (typeof context === "object" && context !== null && "i18n" in context && context.i18n instanceof I18n) {
      return context.i18n
    }
  } catch {
    // Outside a request there's no middleware context.
  }
  return undefined
}

interface DehydratedLocale {
  locale: string
  messages: Messages
}

function isDehydratedLocale(value: unknown): value is DehydratedLocale {
  return (
    typeof value === "object" &&
    value !== null &&
    "locale" in value &&
    typeof value.locale === "string" &&
    "messages" in value &&
    typeof value.messages === "object" &&
    value.messages !== null
  )
}

/** The locale and messages the server sent with the router's state. */
function dehydratedLocale(state: unknown): DehydratedLocale | undefined {
  if (typeof state !== "object" || state === null || !("i18n" in state)) {
    return undefined
  }
  return isDehydratedLocale(state.i18n) ? state.i18n : undefined
}

interface LocaleWrapProps {
  children: ReactNode
}

/**
 * Gives the router the request's Lingui instance. The server renders with it and sends its locale and messages with
 * the router's state, and the browser activates the same locale before it hydrates. Modelled on Lingui's TanStack
 * Start example.
 */
export function withI18n(router: AnyRouter) {
  const i18n = requestI18n() ?? createI18n(sourceLocale, {})
  const { Wrap: Inner, dehydrate, hydrate } = router.options
  router.options.Wrap = function LocaleWrap({ children }: LocaleWrapProps) {
    return <LocaleProvider i18n={i18n}>{Inner ? <Inner>{children}</Inner> : children}</LocaleProvider>
  }
  if (router.isServer) {
    router.options.dehydrate = async () => ({
      ...(await dehydrate?.()),
      i18n: { locale: i18n.locale, messages: i18n.messages }
    })
  } else {
    router.options.hydrate = async (dehydrated: unknown) => {
      await hydrate?.(dehydrated)
      const state = dehydratedLocale(dehydrated)
      if (state && isLocale(state.locale)) {
        i18n.loadAndActivate({ locale: state.locale, messages: state.messages })
      }
    }
    followLocale(router, i18n)
  }
}
