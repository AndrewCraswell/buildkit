import { setupI18n, type I18n, type Messages } from "@lingui/core"
import type { Locale } from "./locales"

/**
 * A new Lingui instance with one locale active. On the server, make one for each request and never share it: an
 * instance holds its locale, so a shared one would show one visitor's language to another. `loadMessages` in
 * ./catalogs gives a locale's messages.
 */
export function createI18n(locale: Locale, messages: Messages): I18n {
  return setupI18n({ locale, messages: { [locale]: messages } })
}
