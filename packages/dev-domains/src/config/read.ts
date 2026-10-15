import path from "node:path"
import { loadConfig } from "c12"

/** c12 is deliberately limited to the selected local file. */
export async function readConfigFile(file: string): Promise<unknown> {
  return (
    await loadConfig({
      cwd: path.dirname(file),
      configFile: file,
      configFileRequired: true,
      name: "dev-domains",
      dotenv: false,
      rcFile: false,
      globalRc: false,
      packageJson: false,
      envName: false,
      omit$Keys: false,
      extend: false,
      giget: false
    })
  ).config
}
