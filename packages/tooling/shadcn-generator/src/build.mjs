import { rmSync, copyFileSync } from "node:fs"
import { resolve } from "node:path"
import { generateSources } from "./generate.mjs"
import { pnpm, root } from "./shared.mjs"

const style = process.argv[2]
const directory = process.cwd()
const allowed = resolve(root, "packages/shadcn", `shadcn-baseui-${style}`)
if (directory !== allowed) {
  throw new Error("Unexpected build directory")
}
await generateSources(style, process.cwd())
rmSync(resolve(directory, "dist"), { recursive: true, force: true })
pnpm(["exec", "tsc", "-p", ".generated/tsconfig.json"], process.cwd())
copyFileSync(resolve(directory, ".generated/tokens.json"), resolve(directory, "dist/tokens.json"))
for (const sheet of ["styles", "styles-no-reset"]) {
  pnpm(["exec", "tailwindcss", "-i", `.generated/${sheet}.css`, "-o", `dist/${sheet}.css`, "--minify"], process.cwd())
}
