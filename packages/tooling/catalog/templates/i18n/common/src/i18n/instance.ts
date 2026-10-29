import { setupI18n, type I18n, type Messages } from "@lingui/core"
import type { Locale } from "./locales"

function hasMessages(module: unknown): module is { messages: Messages } {
  return (
    typeof module === "object" &&
    module !== null &&
    "messages" in module &&
    typeof module.messages === "object" &&
    module.messages !== null
  )
}

/**
 * A locale's messages. Lingui's Vite plugin compiles each catalog when it's imported, and Vite bundles each one as its
 * own chunk, so loading one needs no file system.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const catalog: unknown = await import(`../locales/${locale}.po`)
  if (!hasMessages(catalog)) {
    throw new Error(`src/locales/${locale}.po didn't compile to messages.`)
  }
  return catalog.messages
}

/**
 * A new Lingui instance with one locale active. On the server, make one for each request and never share it: an
 * instance holds its locale, so a shared one would show one visitor's language to another.
 */
export function createI18n(locale: Locale, messages: Messages): I18n {
  return setupI18n({ locale, messages: { [locale]: messages } })
}
