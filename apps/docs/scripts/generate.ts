import { execFileSync } from "node:child_process"
import { cpSync, globSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve, relative, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { documentationSections, packagePages, type PackageEntry } from "../navigation.ts"

const app = resolve(fileURLToPath(new URL("../", import.meta.url)))
const root = resolve(app, "../..")
const content = resolve(app, "content")
const modelFolder = resolve(root, "dist/api-models")
const require = createRequire(import.meta.url)
const documenter = resolve(dirname(require.resolve("@microsoft/api-documenter/package.json")), "bin/api-documenter")
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
const input: unknown = JSON.parse(readFileSync(resolve(modelFolder, "index.json"), "utf8"))
if (!Array.isArray(input) || input.length === 0) {
  throw new Error("Generate API models first: pnpm check:api")
}
const models = input.map((value: unknown) => {
  if (
    !isRecord(value) ||
    typeof value.package !== "string" ||
    typeof value.entryPoint !== "string" ||
    typeof value.model !== "string"
  ) {
    throw new Error("Invalid API model index")
  }
  return { package: value.package, entryPoint: value.entryPoint, model: value.model }
})
// Only these generated directories may be replaced. Resolve and verify before recursive removal.
for (const directory of [
  resolve(content, "reference"),
  resolve(content, "packages"),
  resolve(app, "dist/documenter-inputs")
]) {
  if (!directory.startsWith(app + sep)) {
    throw new Error("Generated path escapes the docs app")
  }
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
}
const catalog: PackageEntry[] = []
const groups: Record<string, string> = {
  core: "Core",
  react: "React",
  shadcn: "shadcn",
  fluentui: "Fluent UI",
  tooling: "Developer tools"
}
for (const manifest of globSync("packages/*/*/package.json", { cwd: root }).sort()) {
  const manifestPath = resolve(root, manifest)
  const pkg: unknown = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (!isRecord(pkg) || typeof pkg.name !== "string" || !pkg.name.startsWith("@buildkitgg/")) {
    continue
  }
  const name = pkg.name.slice("@buildkitgg/".length)
  const packageModels = models.filter((model) => model.package === pkg.name)
  if (!packageModels.length) {
    throw new Error(`No API models for ${pkg.name}`)
  }
  const packageFolder = dirname(manifestPath)
  const guideFolder = resolve(content, "packages", name)
  mkdirSync(guideFolder, { recursive: true })
  const readme = readFileSync(resolve(packageFolder, "README.md"), "utf8")
  // Preserve in-page anchors; retain the source location of relative maintenance links.
  const guide = readme.replace(/\]\(([^)]+)\)/g, (match: string, href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) {
      return match
    }
    const [path, anchor] = href.split("#")
    const repositoryPath = relative(root, resolve(packageFolder, path ?? "")).replaceAll("\\", "/")
    return `](https://github.com/AndrewCraswell/buildkit/blob/main/${repositoryPath}${anchor ? "#" + anchor : ""})`
  })
  const entryLinks: { name: string; link: string }[] = []
  for (const model of packageModels) {
    const entrySlug = model.entryPoint === "." ? "root" : model.entryPoint.slice(2).replaceAll("/", "--")
    const importPath = pkg.name + (model.entryPoint === "." ? "" : model.entryPoint.slice(1))
    const output = resolve(content, "reference", name, entrySlug)
    const staging = resolve(app, "dist/documenter-inputs", name, entrySlug)
    mkdirSync(staging, { recursive: true })
    cpSync(resolve(modelFolder, model.model), resolve(staging, model.model))
    execFileSync(process.execPath, [documenter, "markdown", "--input-folder", staging, "--output-folder", output], {
      stdio: ["ignore", "pipe", "pipe"]
    })
    const packagePage = readdirSync(output).find((file) => file === `${name}.md`)
    if (!packagePage) {
      throw new Error(`API Documenter did not generate ${name}.md`)
    }
    const link = `/reference/${name}/${entrySlug}/${name}`
    entryLinks.push({ name: importPath, link })
    for (const file of readdirSync(output).filter((file) => file.endsWith(".md"))) {
      const filePath = resolve(output, file)
      writeFileSync(
        filePath,
        `---\neditLink: false\n---\n\n> Import path: \`${importPath}\`\n\n${readFileSync(filePath, "utf8")}`
      )
    }
    writeFileSync(
      resolve(output, "index.md"),
      `# ${importPath}\n\nGenerated from public TypeScript declarations and doc comments.\n\n[Browse this entry point](${link})\n`
    )
  }
  const pages = packagePages(name)
  const additionalReference = pages.length
    ? `\n\n## Further reference\n\n${pages.map((page) => `- [${page.text}](${page.link})`).join("\n")}`
    : ""
  writeFileSync(
    resolve(guideFolder, "index.md"),
    `---\neditLink: false\n---\n\n${guide}${additionalReference}\n\n## API reference\n\n${entryLinks.map((entry) => `- [\`${entry.name}\`](${entry.link})`).join("\n")}\n`
  )
  const area = manifest.replaceAll("\\", "/").split("/")[1] ?? ""
  catalog.push({ name, layer: groups[area] ?? area, guide: `/packages/${name}/`, entries: entryLinks })
}
writeFileSync(resolve(content, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n")
const sections = documentationSections(catalog)
const packageIndex = sections
  .map(
    (section) =>
      `## ${section.text}\n\n${section.link ? `[Overview](${section.link})\n\n` : ""}${section.packages
        .map((pkg) => `- [${pkg.title}](${pkg.guide})`)
        .join("\n")}`
  )
  .join("\n\n")
writeFileSync(
  resolve(content, "packages/index.md"),
  `# Package guides\n\nInstallation and usage, rendered from each package’s README.\n\n${packageIndex}\n`
)
writeFileSync(
  resolve(content, "reference/index.md"),
  `# API reference\n\nGenerated from public exports with Microsoft API Extractor and API Documenter. Subpath imports have their own reference pages. Explanations appear where the source has doc comments.\n\n${sections.map((section) => `## ${section.text}\n\n${section.packages.map((pkg) => `### ${pkg.title}\n\n${pkg.entries.map((entry) => `- [\`${entry.name}\`](${entry.link})`).join("\n")}`).join("\n\n")}`).join("\n\n")}\n`
)
mkdirSync(resolve(content, "public"), { recursive: true })
cpSync(resolve(root, "apps/site/public/mark.svg"), resolve(content, "public/mark.svg"))
process.stdout.write(`Generated ${catalog.length} package guides and ${models.length} entry-point references.\n`)

// Import command definitions, not the CLI entry point. Reading metadata never calls setup or run.
const cli: unknown = await import(
  pathToFileURL(resolve(root, "packages/tooling/dev-domains/dist/cli/commands.js")).href
)
if (!isRecord(cli) || !isRecord(cli.commands)) {
  throw new Error("The dev-domains command definitions are unavailable")
}
const commandSections = Object.entries(cli.commands)
  .map(([name, definition]) => {
    if (!isRecord(definition) || !isRecord(definition.meta) || typeof definition.meta.description !== "string") {
      throw new Error(`Unsupported command metadata for ${name}`)
    }
    const args = definition.args ?? {}
    if (!isRecord(args)) {
      throw new Error(`Unsupported argument metadata for ${name}`)
    }
    const rows = Object.entries(args).map(([argName, arg]) => {
      if (!isRecord(arg) || typeof arg.type !== "string") {
        throw new Error(`Unsupported argument metadata for ${name}.${argName}`)
      }
      const flag = arg.type === "positional" ? argName : "--" + argName
      const detail = typeof arg.description === "string" ? arg.description : ""
      const defaultValue = "default" in arg ? JSON.stringify(arg.default) : "—"
      return `| \`${flag}\` | ${arg.type} | ${arg.required ? "Yes" : "No"} | ${defaultValue} | ${detail} |`
    })
    const argumentReference = rows.length
      ? `| Argument | Type | Required | Default | Description |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`
      : "No command-specific arguments.\n"
    return `## ${name}\n\n${definition.meta.description}\n\n\`\`\`sh\nnpx @buildkitgg/dev-domains ${name} --help\n\`\`\`\n\n${argumentReference}`
  })
  .join("\n")
writeFileSync(
  resolve(content, "packages/dev-domains/commands.md"),
  `---\neditLink: false\n---\n\n# dev-domains CLI reference\n\nPart of the [dev-domains documentation](/packages/dev-domains/). See the guide for installation, configuration, and examples.\n\nGenerated from the CLI’s command and argument definitions. These commands run in a terminal, not in this page.\n\n${commandSections}`
)
