import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { renderToString } from "react-dom/server"
import { Page } from "./Page"

const file = resolve("dist/index.html")
const html = readFileSync(file, "utf8")
if (!html.includes("<!--app-->")) {
  throw new Error("The static page template is missing its render marker")
}
writeFileSync(file, html.replace("<!--app-->", renderToString(<Page />, { identifierPrefix: "buildkit-" })))
process.stdout.write("Prerendered the marketing page and package catalog.\n")
