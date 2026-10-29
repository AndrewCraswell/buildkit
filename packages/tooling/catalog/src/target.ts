import { defineTarget, type Contribution, type TargetContext } from "@buildkitgg/scaffolder"
import { dependency, file, fromTemplate, json, jsonItems, jsonKey } from "./files.js"
import { generatedFolder, startPoints } from "./points.js"
import { printWidth } from "./settings.js"

const common = "tanstack-start/common"

/** Paths tools regenerate. The formatter and linter skip them, and GitHub collapses them in diffs. */
const generatedPaths = [`${generatedFolder}/**`, "src/routeTree.gen.ts", ".buildkit/lock.json"]

const compilerOptions = {
  target: "ES2023",
  lib: ["ES2023", "DOM", "DOM.Iterable"],
  module: "ESNext",
  moduleResolution: "Bundler",
  jsx: "react-jsx",
  strict: true,
  noUncheckedIndexedAccess: true,
  noFallthroughCasesInSwitch: true,
  isolatedModules: true,
  skipLibCheck: true,
  noEmit: true
}

function appName(name: string): string {
  return ["/** The app's name, shown in page titles. */", `export const appName = ${JSON.stringify(name)}`, ""].join(
    "\n"
  )
}

function base(ctx: TargetContext): Contribution[] {
  const mode = ctx.target.mode
  return [
    jsonKey("package.json", "/name", ctx.project.name),
    jsonKey("package.json", "/version", "0.0.0"),
    jsonKey("package.json", "/private", true),
    jsonKey("package.json", "/type", "module"),
    jsonKey("package.json", "/packageManager", "pnpm@12.10.1"),
    jsonKey("package.json", "/engines", { node: ">=24" }),
    { kind: "script", name: "dev", command: "vite dev" },
    { kind: "script", name: "build", command: "vite build" },
    { kind: "script", name: "preview", command: "vite preview" },
    { kind: "script", name: "typecheck", command: "tsc --noEmit" },
    { kind: "script", name: "lint", command: "oxlint --max-warnings=0" },
    { kind: "script", name: "format", command: "oxfmt" },
    { kind: "script", name: "format:check", command: "oxfmt --check" },
    ...["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"].map((name) => dependency(ctx, name)),
    ...[
      "@buildkitgg/cli",
      "vite",
      "@vitejs/plugin-react",
      "oxc-transform-react",
      "typescript",
      "@types/react",
      "@types/react-dom",
      "@types/node",
      "oxlint",
      "oxfmt"
    ].map((name) => dependency(ctx, name, true)),
    { kind: "json", path: "tsconfig.json", pointer: "/compilerOptions", op: "merge", value: compilerOptions },
    jsonItems("tsconfig.json", "/compilerOptions/types", ["vite/client", "node"]),
    jsonItems("tsconfig.json", "/include", ["src", "vite.config.ts"]),
    {
      kind: "lines",
      path: ".gitignore",
      lines: ["node_modules/", "dist/", ".output/", ".tanstack/", "coverage/", ".env", ".env.*", "!.env.example"]
    },
    {
      kind: "lines",
      path: ".gitattributes",
      lines: ["* text=auto eol=lf", ...generatedPaths.map((path) => `${path} linguist-generated`)]
    },
    file(
      ".oxlintrc.json",
      json({
        $schema: "./node_modules/oxlint/configuration_schema.json",
        plugins: ["typescript", "react", "jsx-a11y", "import", "oxc", "unicorn"],
        categories: { correctness: "error" },
        ignorePatterns: ["dist/**", ".output/**", ...generatedPaths]
      })
    ),
    file(
      ".oxfmtrc.json",
      json({
        $schema: "./node_modules/oxfmt/configuration_schema.json",
        // The engine lays out the JSON it edits for this width, so package.json, tsconfig.json and buildkit.jsonc are
        // formatted like the rest. It keeps package.json's key order, so the formatter doesn't sort it.
        printWidth,
        semi: false,
        trailingComma: "none",
        sortImports: { enabled: true, newlinesBetween: false, sortSpecifiers: true },
        sortPackageJson: false,
        ignorePatterns: ["dist/**", ".output/**", "pnpm-lock.yaml", ...generatedPaths]
      })
    ),
    fromTemplate(`tanstack-start/${mode}`, "vite.config.ts"),
    fromTemplate(common, "src/start.ts"),
    fromTemplate(common, "src/router.tsx"),
    fromTemplate(common, "src/client.tsx"),
    fromTemplate(common, "src/routes/__root.tsx"),
    fromTemplate(common, "src/app/providers.tsx"),
    fromTemplate(common, "src/components/route-states.tsx"),
    fromTemplate(common, "src/styles.css"),
    file("src/app/site.ts", appName(ctx.project.name)),
    fromTemplate(common, "src/routes/index.tsx", "sample"),
    fromTemplate(common, "AGENTS.md", "sample"),
    fromTemplate(common, "README.md", "sample"),
    { kind: "command", run: "pnpm install", when: "after-apply", why: "Installs the dependencies." },
    {
      kind: "command",
      run: "pnpm build",
      when: "after-install",
      why: "Generates src/routeTree.gen.ts, which pnpm typecheck reads. pnpm dev keeps it current."
    }
  ]
}

/**
 * TanStack Start with React, server-rendered or as a single-page app. It names no cloud: an app deploys through Better
 * Apps' deploy service, whose Vite plugin goes in the `framework` band of `vite.plugins`, before `tanstackStart()`.
 */
export const tanstackStart = defineTarget({
  id: "tanstack-start",
  title: "TanStack Start",
  description: "A React app on TanStack Start, with file-based routes and server functions.",
  family: "tanstack-start",
  modes: [
    {
      id: "ssr",
      title: "Server-rendered",
      renderModel: "ssr-loader",
      facets: ["react", "vite", "ssr", "request-middleware", "root-loader", "router-rewrite", "server-functions"]
    },
    {
      id: "spa",
      title: "Single-page app",
      renderModel: "spa",
      facets: ["react", "vite", "spa", "router-rewrite", "server-functions"]
    }
  ],
  points: startPoints,
  base
})
