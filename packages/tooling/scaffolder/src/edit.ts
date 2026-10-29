/** `@buildkitgg/scaffolder/edit`: pure text transforms that keep comments and formatting. They run anywhere. */
export { readEnv, removeEnvKey, setEnvValue } from "./edit/env.js"
export {
  insertJsonArrayItem,
  jsonFormatting,
  parseJsonc,
  removeJson,
  replaceJsonArrayItem,
  setJson,
  stringifyJson
} from "./edit/json.js"
export type { JsonParseResult, JsonPath } from "./edit/json.js"
export { jsonLayoutFor, printJson } from "./edit/layout.js"
export type { JsonLayout, Position as JsonPosition, PrintJsonOptions } from "./edit/layout.js"
export { appendLines, hasLine, isSecretLikePattern, readLines, removeLines } from "./edit/lines.js"
export { insertYamlArrayItem, parseYaml, removeYaml, replaceYamlArrayItem, setYaml } from "./edit/yaml.js"
export { mergeText } from "./merge/text.js"
export type { TextMerge } from "./merge/text.js"
