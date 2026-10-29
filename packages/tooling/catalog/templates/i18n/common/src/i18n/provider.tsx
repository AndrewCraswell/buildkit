import type { I18n } from "@lingui/core"
import { I18nProvider, useLingui } from "@lingui/react"
import type { ReactNode } from "react"
import { htmlLangDir } from "./match"

export interface LocaleProviderProps {
  i18n: I18n
  children: ReactNode
}

/** Lingui's provider for one instance: the request's on the server, the browser's in the browser. */
export function LocaleProvider({ i18n, children }: LocaleProviderProps) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

/** The `<html lang dir>` attributes of the active locale. */
export function useLocaleAttributes() {
  const { i18n } = useLingui()
  return htmlLangDir(i18n.locale)
}
