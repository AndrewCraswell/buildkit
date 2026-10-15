import { defineCommand, type ArgsDef, type CommandDef } from "citty"
import { Cancelled } from "./terminal.js"

/** Keep operational errors concise; argument/help errors remain Citty's responsibility. */
export function defineCliCommand<const T extends ArgsDef>(definition: CommandDef<T>): CommandDef<T> {
  return defineCommand({
    ...definition,
    async run(context) {
      try {
        return await definition.run?.(context)
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = error instanceof Cancelled ? 130 : 1
      }
    }
  })
}
