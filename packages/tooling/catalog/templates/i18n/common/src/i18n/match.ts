import { detection, localeCookie, locales, localizedUrls, sourceLocale, type Locale } from "./locales"

/** Languages written right to left. */
const rightToLeft = new Set(["ar", "ckb", "dv", "fa", "he", "ks", "ps", "sd", "ug", "ur", "yi"])

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value)
}

/** The supported locale that best matches a language tag: the same tag, or the same language, such as fr for fr-CA. */
export function matchLocale(tag: string): Locale | undefined {
  const wanted = tag.trim().toLowerCase()
  const language = wanted.split("-")[0]
  return (
    locales.find((locale) => locale.toLowerCase() === wanted) ??
    locales.find((locale) => locale.toLowerCase().split("-")[0] === language)
  )
}

/** The locale a path starts with, such as fr for /fr/about. The source locale's paths have no prefix. */
export function localeFromPath(pathname: string): Locale | undefined {
  if (!localizedUrls) {
    return undefined
  }
  const [, first = ""] = pathname.split("/")
  return locales.find((locale) => locale !== sourceLocale && locale === first)
}

/** Removes a locale prefix: /fr/about becomes /about. */
export function stripLocale(pathname: string, locale: Locale): string {
  const rest = pathname.slice(locale.length + 1)
  return rest.startsWith("/") ? rest : `/${rest}`
}

/** Adds a locale prefix, except for the source locale: /about becomes /fr/about. */
export function addLocale(pathname: string, locale: Locale): string {
  if (locale === sourceLocale) {
    return pathname
  }
  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`
}

/** The language tags of an Accept-Language header, most preferred first. */
export function acceptedLanguages(header: string | null): string[] {
  return (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...parameters] = part.split(";").map((piece) => piece.trim())
      const quality = parameters.find((parameter) => parameter.startsWith("q="))
      return { tag, quality: quality === undefined ? 1 : Number(quality.slice(2)) }
    })
    .filter((entry) => entry.tag !== "" && entry.tag !== "*" && entry.quality > 0)
    .sort((left, right) => right.quality - left.quality)
    .map((entry) => entry.tag)
}

/** The locale cookie's value, from a Cookie header or document.cookie. */
export function cookieLocale(cookies: string | null): Locale | undefined {
  for (const pair of (cookies ?? "").split(";")) {
    const [name = "", value = ""] = pair.split("=").map((piece) => piece.trim())
    if (name === localeCookie) {
      return matchLocale(value)
    }
  }
  return undefined
}

/** What a visitor's locale can come from. */
export interface LocaleSources {
  pathname: string
  cookies: string | null
  languages: readonly string[]
}

function fromSource(source: (typeof detection)[number], sources: LocaleSources): Locale | undefined {
  switch (source) {
    case "url":
      return localeFromPath(sources.pathname)
    case "cookie":
      return cookieLocale(sources.cookies)
    case "header":
      return sources.languages.map(matchLocale).find((locale) => locale !== undefined)
  }
}

/** The visitor's locale, from the sources in the detection option, in order. Falls back to the source locale. */
export function detectLocale(sources: LocaleSources): Locale {
  for (const source of detection) {
    const found = fromSource(source, sources)
    if (found) {
      return found
    }
  }
  return sourceLocale
}

/** The `<html>` attributes for a locale: its tag, and whether it's written right to left. */
export function htmlLangDir(locale: string): { lang: string; dir: "ltr" | "rtl" } {
  const language = locale.toLowerCase().split("-")[0] ?? ""
  return { lang: locale, dir: rightToLeft.has(language) ? "rtl" : "ltr" }
}
