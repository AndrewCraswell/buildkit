import { readFileSync, existsSync, rmSync } from "node:fs"
import { resolve, relative, posix } from "node:path"
import { pathToFileURL } from "node:url"
import postcss from "postcss"
import { createStyleMap, transformStyle, transformIcons } from "shadcn/utils"
import { Project, ts } from "ts-morph"
import { root, templatePath, tool, snapshot, variants, readJson, write, writeJson, pnpm } from "./shared.mjs"
import { designTokens } from "./tokens.mjs"

const data = snapshot()
const template = readJson(templatePath)
const project = new Project({ useInMemoryFileSystem: true })

async function themeData() {
  const js = ts.transpileModule(data.themes, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  const { THEMES } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`)
  const neutral = THEMES.find((theme) => theme.name === "neutral")
  if (!neutral?.cssVars?.light || !neutral.cssVars.dark) {
    throw new Error("Upstream neutral theme missing")
  }
  const ast = postcss.parse(data.globals)
  const theme = ast.nodes.find((node) => node.type === "atrule" && node.name === "theme" && node.params === "inline")
  if (!theme) {
    throw new Error("Upstream Tailwind token mapping missing")
  }
  // Keep upstream token mappings, but exclude website-specific font/breakpoint customizations.
  const mappings = theme.nodes.filter(
    (node) =>
      node.type === "decl" &&
      (node.prop.startsWith("--radius-") ||
        (node.prop.startsWith("--color-") &&
          (Object.hasOwn(neutral.cssVars.light, node.prop.slice(8)) ||
            Object.hasOwn(neutral.cssVars.dark, node.prop.slice(8)))))
  )
  const vars = (values) =>
    Object.entries(values)
      .map(([key, value]) => `--${key}: ${value};`)
      .join("\n")
  return {
    palette: neutral.name,
    cssVariables: neutral.cssVars,
    tailwind: Object.fromEntries(mappings.map((node) => [node.prop, node.value])),
    css: `@import "tw-animate-css";\n@import "shadcn/tailwind.css";\n@custom-variant dark (&:is(.dark *));\n@theme inline {\n${mappings.map((node) => node.toString() + ";").join("\n")}\n}\n:root {${vars(neutral.cssVars.light)}}\n.dark {${vars(neutral.cssVars.dark)}}\n`
  }
}

export async function generateSources(style, directory) {
  if (!Object.hasOwn(data.styles, style)) {
    throw new Error(`Unknown upstream style: ${style}`)
  }
  const output = resolve(directory, ".generated")
  if (
    !directory.startsWith(resolve(root, "packages/shadcn") + "/") &&
    !directory.startsWith(resolve(root, "packages/shadcn") + "\\")
  ) {
    throw new Error("Generation must stay inside packages/shadcn")
  }
  rmSync(output, { recursive: true, force: true })
  const styleMap = createStyleMap(data.styles[style])
  const exports = []
  for (const [filename, source] of Object.entries(data.sources)) {
    let content = await transformStyle(source, { styleMap })
    const file = project.createSourceFile(filename, content, { overwrite: true })
    if (content.includes("IconPlaceholder")) {
      await transformIcons({ sourceFile: file, filename, raw: content, config: { iconLibrary: "lucide" } })
    }
    for (const declaration of file.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue()
      if (!specifier.startsWith("@/")) {
        continue
      }
      const prefix = "@/registry/bases/base/"
      if (!specifier.startsWith(prefix)) {
        throw new Error(`Unresolved upstream import: ${filename}: ${specifier}`)
      }
      const target = specifier.slice(prefix.length)
      const importedSource = [target + ".ts", target + ".tsx"].find((name) => Object.hasOwn(data.sources, name))
      if (!importedSource) {
        throw new Error(`Missing upstream module: ${specifier}`)
      }
      let path = posix.relative(posix.dirname(filename), target)
      if (!path.startsWith(".")) {
        path = "./" + path
      }
      declaration.setModuleSpecifier(path + ".js")
    }
    content = file.getText()
    if (content.includes("IconPlaceholder")) {
      throw new Error(`Unresolved icon in ${filename}`)
    }
    write(resolve(output, filename), content)
    const modulePath = "./" + filename.replace(/\.tsx?$/, ".js")
    if (filename === "ui/sonner.tsx") {
      exports.push(`export { Toaster as SonnerToaster } from "${modulePath}"`)
    } else {
      exports.push(`export * from "${modulePath}"`)
    }
  }
  write(resolve(output, "index.ts"), '"use client"\n' + exports.join("\n") + "\n")
  write(resolve(output, "styles.ts"), "export {}\n")
  const theme = await themeData()
  write(resolve(output, "shared.css"), '@source "./";\n' + theme.css)
  writeJson(
    resolve(output, "tokens.json"),
    designTokens({
      style,
      repository: data.repository,
      revision: data.revision,
      palette: theme.palette,
      cssVariables: theme.cssVariables,
      tailwind: theme.tailwind
    })
  )
  write(
    resolve(output, "styles.css"),
    '@import "tailwindcss" source(none);\n@import "./shared.css";\n@layer base { * { @apply border-border outline-ring/50; } body { @apply bg-background text-foreground; } }\n'
  )
  write(
    resolve(output, "styles-no-reset.css"),
    '@layer theme, base, components, utilities;\n@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css" layer(utilities) source(none);\n@import "./shared.css";\n'
  )
  writeJson(resolve(output, "tsconfig.json"), {
    extends: relative(output, resolve(root, "packages/tooling/typescript-config/react-library.json")).replaceAll(
      "\\",
      "/"
    ),
    compilerOptions: {
      rootDir: ".",
      outDir: "../dist",
      declarationMap: false,
      sourceMap: false,
      noEmit: false,
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"]
    },
    include: ["**/*.ts", "**/*.tsx"]
  })
  writeJson(resolve(directory, "upstream.json"), {
    repository: data.repository,
    revision: data.revision,
    style: `base-${style}`,
    generator: readJson(resolve(root, "packages/tooling/shadcn-generator/package.json")).devDependencies.shadcn,
    components: Object.keys(data.sources)
      .filter((name) => name.startsWith("ui/"))
      .map((name) => posix.basename(name, ".tsx"))
  })
}

export function generateManifests() {
  for (const { style, directory } of variants(data)) {
    const manifestPath = resolve(directory, "package.json")
    const existing = existsSync(manifestPath) ? readJson(manifestPath) : undefined
    const name = `@buildkitgg/shadcn-baseui-${style}`
    const location = relative(root, directory).replaceAll("\\", "/")
    writeJson(manifestPath, {
      name,
      version: existing?.version ?? template.version,
      type: "module",
      license: "MIT",
      description: `Upstream shadcn Base UI components in the ${style} style, with compiled CSS and TypeScript declarations.`,
      scripts: {
        build: `node ../../tooling/shadcn-generator/src/build.mjs ${style}`,
        "check:types": "pnpm build",
        prepack: "pnpm build"
      },
      peerDependencies: template.peerDependencies,
      dependencies: template.dependencies,
      devDependencies: { "@repo/shadcn-generator": "workspace:*" },
      files: [
        "dist/**/*.js",
        "dist/**/*.d.ts",
        "dist/*.css",
        "dist/tokens.json",
        "README.md",
        "LICENSE",
        "upstream.json",
        "CHANGELOG.md"
      ],
      exports: template.exports,
      types: template.types,
      sideEffects: template.sideEffects,
      repository: { ...template.repository, directory: location },
      homepage: `https://github.com/AndrewCraswell/buildkit/tree/main/${location}#readme`,
      bugs: template.bugs,
      publishConfig: template.publishConfig,
      ...(existing?.private ? { private: true } : {})
    })
    write(resolve(directory, "LICENSE"), readFileSync(resolve(tool, "LICENSE"), "utf8"))
    write(
      resolve(directory, "README.md"),
      `# ${name}\n\nGenerated from the pinned upstream shadcn Base UI catalog. Do not edit generated components.\n\nSelect this style once using a dependency alias:\n\n\`\`\`sh\npnpm add @buildkitgg/shadcn-baseui-kit@npm:${name}\n\`\`\`\n\n\`\`\`tsx\nimport { Button } from "@buildkitgg/shadcn-baseui-kit"\nimport "@buildkitgg/shadcn-baseui-kit/styles.css"\n\`\`\`\n\nBuildkit's shadcn managers use the same peer dependency and inherit this selection.\nImport styles once at the app entry. Use \`styles-no-reset.css\` when the app already supplies Tailwind's reset.\nColors and light/dark mode remain customizable through CSS variables. Style selection is installation-time, not runtime.\n\n[Setup, maintenance, and release checks](https://github.com/AndrewCraswell/buildkit/blob/main/docs/shadcn/styles.md).\n`
    )
  }
}

function generateDocumentation() {
  const entries = variants(data).map(({ style }) => ({
    name: `shadcn-baseui-${style}`,
    group: "shadcn",
    summary: `The upstream ${style} style with the full Base UI component catalog, compiled CSS, and TypeScript declarations.`,
    code: `pnpm add @buildkitgg/shadcn-baseui-kit@npm:@buildkitgg/shadcn-baseui-${style}\n\nimport { Button } from "@buildkitgg/shadcn-baseui-kit"\nimport "@buildkitgg/shadcn-baseui-kit/styles.css"`,
    api: [
      "Root export: components, component types, and shared utilities.",
      "styles.css: compiled styles with Tailwind Preflight.",
      "styles-no-reset.css: compiled styles for apps that supply their own reset.",
      "tokens.json: light/dark defaults with resolvedValue and sourceValue."
    ],
    notes:
      "The shared kit name is a dependency alias, not an additional package. Modal and alert managers use that peer dependency. Select a style at installation; customize colors and light/dark mode through CSS variables. See the upstream shadcn documentation for individual components.",
    example: "shadcn-shadcn-modals-manager--confirmation"
  }))
  const documentation = resolve(root, "apps/behavior-storybook/src/documentation")
  write(
    resolve(documentation, "shadcnStyles.ts"),
    `// Generated from the upstream style catalog.\nexport const shadcnStylePackages = ${JSON.stringify(entries, null, 2)} as const\n`
  )
  write(
    resolve(documentation, "shadcn-style-packages.stories.tsx"),
    `// Generated from the upstream style catalog.\nimport type { Meta, StoryObj } from "@storybook/react-vite"\nimport { PackageOverview } from "./PackageOverview.js"\nconst meta = { title: "shadcn/Styles", component: PackageOverview, args: {name: "shadcn-baseui-nova"}, parameters: {buildkitDocumentation: true, layout: "fullscreen", controls: {disable: true}} } satisfies Meta<typeof PackageOverview>\nexport default meta\ntype Story = StoryObj<typeof meta>\n${variants(
      data
    )
      .map(
        ({ style }) =>
          `export const ${style[0].toUpperCase() + style.slice(1)}: Story = { args: { name: "shadcn-baseui-${style}" } }`
      )
      .join("\n")}\n`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  generateManifests()
  generateDocumentation()
  for (const { style, directory } of variants(data)) {
    await generateSources(style, directory)
    process.stdout.write(`Generated ${style}: ${directory}`)
  }
  pnpm([
    "exec",
    "oxfmt",
    ...variants(data).map((item) => item.directory),
    resolve(root, "apps/behavior-storybook/src/documentation/shadcnStyles.ts"),
    resolve(root, "apps/behavior-storybook/src/documentation/shadcn-style-packages.stories.tsx")
  ])
}
