import type { LocationRewrite } from "@tanstack/react-router"
import { getGlobalStartContext } from "@tanstack/react-start"
import { sourceLocale, type Locale } from "./locales"
import { addLocale, isLocale, localeFromPath, stripLocale } from "./match"

/** The locale links are written in: the page's `<html lang>` in the browser, and the request's on the server. */
function currentLocale(): Locale {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang
    return isLocale(lang) ? lang : sourceLocale
  }
  try {
    const context: unknown = getGlobalStartContext()
    if (
      typeof context === "object" &&
      context !== null &&
      "locale" in context &&
      typeof context.locale === "string" &&
      isLocale(context.locale)
    ) {
      return context.locale
    }
  } catch {
    // Outside a request, such as while prerendering, links use the source locale.
  }
  return sourceLocale
}

/**
 * Keeps the locale out of your routes: /fr/about reaches the /about route, and a link to /about comes out as /fr/about
 * on a French page. The source locale's URLs have no prefix.
 */
export const localeRewrite: LocationRewrite = {
  input: ({ url }) => {
    const locale = localeFromPath(url.pathname)
    if (!locale) {
      return undefined
    }
    url.pathname = stripLocale(url.pathname, locale)
    return url
  },
  output: ({ url }) => {
    const locale = currentLocale()
    if (locale === sourceLocale) {
      return undefined
    }
    url.pathname = addLocale(url.pathname, locale)
    return url
  }
}
