import type { I18n } from "@lingui/core"
import type { AnyRouter } from "@tanstack/react-router"
import { loadMessages } from "./catalogs"
import { detectLocale, htmlLangDir } from "./match"

/**
 * Keeps the browser's locale in step with client-side navigation, such as a link to /fr/about from an English page.
 * Each navigation detects the locale as a page load does, and a different one is activated with its messages. `<html
 * lang>` changes first, because links take their locale prefix from it.
 */
export function followLocale(router: AnyRouter, i18n: I18n) {
  let latest = 0
  router.subscribe("onBeforeLoad", ({ toLocation, pathChanged }) => {
    if (!pathChanged) {
      return
    }
    // Only the newest navigation's locale is activated, whichever catalog loads first.
    const navigation = ++latest
    const locale = detectLocale({
      pathname: new URL(toLocation.publicHref, window.location.href).pathname,
      cookies: document.cookie,
      languages: navigator.languages
    })
    if (locale === i18n.locale) {
      return
    }
    loadMessages(locale).then(
      (messages) => {
        if (navigation !== latest) {
          return
        }
        const { lang, dir } = htmlLangDir(locale)
        document.documentElement.lang = lang
        document.documentElement.dir = dir
        i18n.loadAndActivate({ locale, messages })
      },
      (error: unknown) => console.error(`Couldn't load the ${locale} messages.`, error)
    )
  })
}
