import { createMiddleware } from "@tanstack/react-start"
import { loadMessages } from "./catalogs"
import { createI18n } from "./instance"
import { detection } from "./locales"
import { acceptedLanguages, detectLocale } from "./match"

// A page whose locale comes from a cookie or a header differs by them, so shared caches must keep a copy for each.
const vary = detection.flatMap((source) => {
  if (source === "cookie") {
    return ["Cookie"]
  }
  return source === "header" ? ["Accept-Language"] : []
})

/**
 * Detects each request's locale and creates a Lingui instance for that request alone. A server answers many visitors
 * at once, so a shared instance would show one visitor's language to another. The router reads the instance from the
 * middleware context.
 */
export const localeMiddleware = createMiddleware({ type: "request" }).server(async ({ request, next }) => {
  const locale = detectLocale({
    pathname: new URL(request.url).pathname,
    cookies: request.headers.get("cookie"),
    languages: acceptedLanguages(request.headers.get("accept-language"))
  })
  const i18n = createI18n(locale, await loadMessages(locale))
  const result = await next({ context: { locale, i18n } })
  if (vary.length > 0) {
    result.response.headers.append("Vary", vary.join(", "))
  }
  return result
})
