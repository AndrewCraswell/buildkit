import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import { resolve } from "node:path"
import { root, variants, readJson, writeJson, write, pnpm, pnpmCommand } from "./shared.mjs"

const matrix = variants()
function declarations(directory) {
  const dist = resolve(directory, "dist")
  return Object.fromEntries(
    readdirSync(dist, { recursive: true })
      .filter((name) => name.endsWith(".d.ts"))
      .sort()
      .map((name) => [name.replaceAll("\\", "/"), readFileSync(resolve(dist, name), "utf8")])
  )
}
const reference = declarations(matrix.find((item) => item.style === "nova").directory)
for (const { style, directory } of matrix) {
  assert.deepEqual(declarations(directory), reference, `${style} declarations differ from Nova`)
  assert.equal(
    readJson(resolve(directory, "package.json")).version,
    readJson(resolve(matrix[0].directory, "package.json")).version,
    "Style versions must be released together"
  )
  const tokens = readJson(resolve(directory, "dist/tokens.json"))
  assert.equal(tokens.style, style)
  assert.equal(tokens.light.background.resolvedValue, "#ffffff")
  assert.ok(tokens.light["radius-sm"].sourceValue.includes("var("))
  const css = readFileSync(resolve(directory, "dist/styles.css"), "utf8")
  assert.ok(css.length > 10000, `${style} stylesheet is empty`)
}
process.stdout.write(`All ${matrix.length} styles have identical declarations.`)

const workspace = resolve(root, "dist/style-consumers")
const tarballs = resolve(workspace, "tarballs")
const packageFolders = [
  ...matrix.map((item) => item.directory),
  "packages/shadcn/shadcn-runtime",
  "packages/core/modal-core",
  "packages/react/react-modals",
  "packages/shadcn/shadcn-modals-manager",
  "packages/core/alert-core",
  "packages/react/react-alerts",
  "packages/shadcn/shadcn-alerts-manager"
].map((path) => resolve(root, path))
const packages = new Map()
for (const directory of packageFolders) {
  const pkg = readJson(resolve(directory, "package.json"))
  const archive = resolve(tarballs, pkg.name.replace("@", "").replace("/", "-") + ".tgz")
  write(resolve(tarballs, ".keep"), "")
  pnpm(["--config.ignore-scripts=true", "pack", "--out", archive], directory, { stdio: "pipe" })
  packages.set(pkg.name, { pkg, archive, bytes: readFileSync(archive) })
}
const server = createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, origin).pathname.slice(1))
  const item = packages.get(name.replace(/\/-\/archive\.tgz$/, ""))
  if (!item) {
    response.writeHead(404)
    response.end()
    return
  }
  if (name.endsWith("/-/archive.tgz")) {
    response.end(item.bytes)
    return
  }
  // Read the package manifest from the tarball, where workspace ranges have been rewritten by pnpm.
  response.setHeader("Content-Type", "application/json")
  response.end(
    JSON.stringify({
      name: item.pkg.name,
      "dist-tags": { latest: item.pkg.version },
      versions: {
        [item.pkg.version]: {
          ...item.packed,
          dist: {
            tarball: `${origin}/${item.pkg.name}/-/archive.tgz`,
            integrity: `sha512-${createHash("sha512").update(item.bytes).digest("base64")}`
          }
        }
      }
    })
  )
})
// tar is available on the supported Node CI operating systems, including Windows.
const { execFileSync } = await import("node:child_process")
for (const item of packages.values()) {
  item.packed = JSON.parse(execFileSync("tar", ["-xOf", item.archive, "package/package.json"], { encoding: "utf8" }))
}
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen))
const origin = `http://127.0.0.1:${server.address().port}`
async function command(args, cwd) {
  await new Promise((resolveDone, reject) => {
    const [executable, commandArgs] = pnpmCommand(args)
    const child = spawn(executable, commandArgs, { cwd, stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolveDone() : reject(new Error(`${args.join(" ")} failed: ${code}`))))
  })
}
try {
  for (const { style, directory } of matrix) {
    const fixture = resolve(workspace, style)
    if (!/^[a-z]+$/.test(style) || !fixture.startsWith(workspace)) {
      throw new Error("Invalid fixture directory")
    }
    rmSync(fixture, { recursive: true, force: true })
    const selected = readJson(resolve(directory, "package.json"))
    write(resolve(fixture, "pnpm-workspace.yaml"), "packages: []\nnodeLinker: isolated\n")
    write(resolve(fixture, ".npmrc"), `@buildkitgg:registry=${origin}\nstrict-peer-dependencies=true\n`)
    writeJson(resolve(fixture, "package.json"), {
      name: `style-consumer-${style}`,
      private: true,
      type: "module",
      dependencies: {
        "@buildkitgg/shadcn-baseui-kit": `npm:${selected.name}@${selected.version}`,
        "@buildkitgg/shadcn-modals-manager": packages.get("@buildkitgg/shadcn-modals-manager").pkg.version,
        "@buildkitgg/shadcn-alerts-manager": packages.get("@buildkitgg/shadcn-alerts-manager").pkg.version,
        react: "19.3.1",
        "react-dom": "19.3.1"
      },
      devDependencies: { vite: "8.3.4", typescript: "7.0.2", "@types/react": "19.3.0", "@types/react-dom": "19.3.0" }
    })
    write(
      resolve(fixture, "index.html"),
      '<html><head><title>Style consumer</title></head><body><div id="root"></div><script type="module" src="/src.tsx"></script></body></html>'
    )
    write(
      resolve(fixture, "src.tsx"),
      `import React from "react"\nimport { createRoot } from "react-dom/client"\nimport { Button } from "@buildkitgg/shadcn-baseui-kit"\nimport "@buildkitgg/shadcn-baseui-kit/styles.css"\nimport "@buildkitgg/shadcn-modals-manager/styles.css"\nimport "@buildkitgg/shadcn-alerts-manager/styles.css"\nimport { createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"\nimport { createAlertManager, AlertRegion } from "@buildkitgg/shadcn-alerts-manager"\nconst modals = createModalManager()\nconst alerts = createAlertManager()\nalerts.info({ title: "${style} selected", body: "The app and both managers use the installed style." })\nfunction App() { return <main style={{padding:24,maxWidth:640,margin:"auto"}}><h1>${style}</h1><AlertRegion manager={alerts}/><Button onClick={() => { void modals.confirm({title:"Confirm selection",description:"This dialog uses the app's selected style."}) }}>Open confirmation</Button><ModalRenderer manager={modals}/></main> }\ncreateRoot(document.getElementById("root")!).render(<App/>)\n`
    )
    writeJson(resolve(fixture, "tsconfig.json"), {
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
        jsx: "react-jsx",
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        noEmit: true
      },
      include: ["src.tsx"]
    })
    write(
      resolve(fixture, "server.mjs"),
      `import assert from 'node:assert/strict';\nimport {createElement} from 'react';\nimport {renderToString} from 'react-dom/server';\nimport {Button, buttonVariants} from '@buildkitgg/shadcn-baseui-kit';\nconst root=import.meta.resolve('@buildkitgg/shadcn-baseui-kit');\nfor(const name of ['@buildkitgg/shadcn-modals-manager','@buildkitgg/shadcn-alerts-manager']) { assert.equal(import.meta.resolve('@buildkitgg/shadcn-baseui-kit',import.meta.resolve(name)),root); }\nassert.match(renderToString(createElement(Button,null,'Selected')),/Selected/);\nprocess.stdout.write(JSON.stringify({style:${JSON.stringify(style)},classes:buttonVariants(),resolved:root}));\n`
    )
    await command(["install", "--no-frozen-lockfile", "--ignore-scripts", "--prefer-offline"], fixture)
    await command(["exec", "tsc", "--noEmit"], fixture)
    await command(["exec", "node", "--experimental-import-meta-resolve", "server.mjs"], fixture)
    await command(["exec", "vite", "build"], fixture)
    // The precompiled path must not require a Tailwind compiler or configuration in the consumer.
    const consumerManifest = readJson(resolve(fixture, "package.json"))
    assert.ok(!consumerManifest.dependencies.tailwindcss && !consumerManifest.devDependencies.tailwindcss)
    // Exercise the alternative build input against the actual packed JavaScript, not workspace TSX.
    await command(["add", "-D", "--ignore-scripts", "tailwindcss@^4.3.3", "@tailwindcss/cli@^4.3.3"], fixture)
    write(
      resolve(fixture, "input.css"),
      '@import "tailwindcss";\n@import "@buildkitgg/shadcn-baseui-kit/tailwind.css";\n'
    )
    await command(["exec", "tailwindcss", "-i", "input.css", "-o", "combined.css", "--minify"], fixture)
    const combined = readFileSync(resolve(fixture, "combined.css"), "utf8")
    assert.ok(combined.includes(".inline-flex"), `${style}: packed component utilities were not scanned`)
    assert.ok(combined.includes(".light"), `${style}: light island variables missing`)
    assert.ok(combined.includes("rtl"), `${style}: RTL utilities missing`)
    assert.doesNotMatch(combined, /@(source|theme|utility)\s/)
    const consumerSource = readFileSync(resolve(fixture, "src.tsx"), "utf8")
      .replace('import "@buildkitgg/shadcn-baseui-kit/styles.css"', 'import "./combined.css"')
      .replace(/import "@buildkitgg\/shadcn-(?:modals|alerts)-manager\/styles.css"\n/g, "")
    write(resolve(fixture, "src.tsx"), consumerSource)
    await command(["exec", "vite", "build"], fixture)
    // Vite must never bundle a second implementation through a manager dependency.
    process.stdout.write(
      `Validated packed ${style}: strict peers, TypeScript, server rendering, and production CSS/JS.`
    )
  }
} finally {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
