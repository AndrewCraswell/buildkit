import { setupI18n, type Messages } from "@lingui/core"
import { loadMessages } from "./catalogs"
import { sourceLocale, type Locale } from "./locales"
import { detectLocale, htmlLangDir } from "./match"

/** The browser's Lingui instance. A single-page app serves one visitor per page, so one instance is safe here. */
export const browserI18n = setupI18n()

/**
 * Detects the visitor's locale from the URL, the locale cookie and the browser's languages, then loads its messages
 * before the first render. Pages are served statically, so the browser detects it instead of the server.
 */
export async function bootstrapLocale() {
  const detected = detectLocale({
    pathname: window.location.pathname,
    cookies: document.cookie,
    languages: navigator.languages
  })
  let locale: Locale = detected
  let messages: Messages
  try {
    messages = await loadMessages(detected)
  } catch (error) {
    // Lingui's provider renders nothing until a locale is active, so a catalog that doesn't load, such as on a lost
    // connection, falls back to the source locale, whose messages come with the app's own code.
    console.error(`Couldn't load the ${detected} messages, so the page is in ${sourceLocale}.`, error)
    locale = sourceLocale
    messages = await loadMessages(sourceLocale)
  }
  browserI18n.loadAndActivate({ locale, messages })
  const { lang, dir } = htmlLangDir(locale)
  document.documentElement.lang = lang
  document.documentElement.dir = dir
}
