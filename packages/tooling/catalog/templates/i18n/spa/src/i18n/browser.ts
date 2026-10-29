import { setupI18n } from "@lingui/core"
import { loadMessages } from "./instance"
import { detectLocale, htmlLangDir } from "./match"

/** The browser's Lingui instance. A single-page app serves one visitor per page, so one instance is safe here. */
export const browserI18n = setupI18n()

/**
 * Detects the visitor's locale from the URL, the locale cookie and the browser's languages, then loads its messages
 * before the first render. Pages are served statically, so the browser detects it instead of the server.
 */
export async function bootstrapLocale() {
  const locale = detectLocale({
    pathname: window.location.pathname,
    cookies: document.cookie,
    languages: navigator.languages
  })
  browserI18n.loadAndActivate({ locale, messages: await loadMessages(locale) })
  const { lang, dir } = htmlLangDir(locale)
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}
