import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Providers } from "../app/providers"
import { appName } from "../app/site"
import { htmlAttributes } from "../generated/buildkit/client"
import styles from "../styles.css?url"

interface HtmlAttributes {
  lang: string
  dir?: "ltr" | "rtl"
}

function useDefaultHtmlAttributes(): HtmlAttributes {
  return { lang: "en" }
}

// The localization add-on sets `lang` and `dir` from the active locale.
const useHtmlAttributes: () => HtmlAttributes = htmlAttributes ?? useDefaultHtmlAttributes

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: appName }
    ],
    links: [{ rel: "stylesheet", href: styles }]
  }),
  shellComponent: RootDocument
})

interface RootDocumentProps {
  children: ReactNode
}

function RootDocument({ children }: RootDocumentProps) {
  const { lang, dir } = useHtmlAttributes()
  return (
    <html lang={lang} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  )
}
