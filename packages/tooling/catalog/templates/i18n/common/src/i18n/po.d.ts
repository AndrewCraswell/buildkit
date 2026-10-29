// Lingui's Vite plugin compiles a .po catalog into a module when it's imported.
declare module "*.po" {
  import type { Messages } from "@lingui/core"

  export const messages: Messages
}
