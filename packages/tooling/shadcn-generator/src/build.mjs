import { rmSync, copyFileSync } from "node:fs"
import { resolve } from "node:path"
import { generateSources } from "./generate.mjs"
import { root, runBin } from "./shared.mjs"

const style = process.argv[2]
const directory = process.cwd()
const allowed = resolve(root, "packages/shadcn", `shadcn-baseui-${style}`)
if (directory !== allowed) {
  throw new Error("Unexpected build directory")
}
await generateSources(style, process.cwd())
rmSync(resolve(directory, "dist"), { recursive: true, force: true })
runBin("typescript", "tsc", ["-p", ".generated/tsconfig.json"], directory)
copyFileSync(resolve(directory, ".generated/tokens.json"), resolve(directory, "dist/tokens.json"))
for (const asset of ["theme.css", "tailwind.css", "animations.css", "shadcn.css"]) {
  copyFileSync(resolve(directory, ".generated", asset), resolve(directory, "dist", asset))
}
for (const sheet of ["styles", "styles-no-reset"]) {
  runBin(
    "@tailwindcss/cli",
    "tailwindcss",
    ["-i", `.generated/${sheet}.css`, "-o", `dist/${sheet}.css`, "--minify"],
    directory
  )
}
