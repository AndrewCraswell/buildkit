import { defineConfig } from "@lingui/cli"
import { locales, sourceLocale } from "./src/i18n/locales"

// One .po catalog per locale in src/locales. The locales come from src/i18n/locales.ts, so both follow one list.
export default defineConfig({
  sourceLocale,
  locales: [...locales],
  catalogs: [{ path: "<rootDir>/src/locales/{locale}", include: ["src"] }]
})
