# Agent guide

A React app on TanStack Start, made with Buildkit. Use Node.js 24 or later and pnpm 12.

- Read `buildkit.jsonc` for the add-ons this app uses, and `package.json` for its commands.
- After a change, run `pnpm lint`, `pnpm build` and `pnpm typecheck`. `pnpm build` regenerates `src/routeTree.gen.ts`.
- Don't edit files under `src/generated/buildkit/`: Buildkit generates them. Change them with `pnpm buildkit add`,
  `pnpm buildkit config` or `pnpm buildkit upgrade`, and run each with `--dry-run --json` first to review the plan.
- To change one generated entry, override it in your own code, such as replacing a plugin from `vitePluginsById` in
  `vite.config.ts`.
- Server-only code goes in `*.server.ts` files. Start refuses a build that imports one from browser code.
- Never put secrets in `VITE_` variables, and never commit `.env`.
