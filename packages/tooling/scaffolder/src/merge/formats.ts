import { insertJsonArrayItem, parseJsonc, removeJson, replaceJsonArrayItem, setJson } from "../edit/json.js"
import { insertYamlArrayItem, parseYaml, removeYaml, replaceYamlArrayItem, setYaml } from "../edit/yaml.js"
import type { DocumentFormat } from "./shared.js"

export const jsonFormat: DocumentFormat = {
  format: "json",
  emptyText: "{}\n",
  parse: parseJsonc,
  set: setJson,
  remove: removeJson,
  insertItem: insertJsonArrayItem,
  replaceItem: replaceJsonArrayItem
}

export const yamlFormat: DocumentFormat = {
  format: "yaml",
  emptyText: "",
  parse: parseYaml,
  set: setYaml,
  remove: removeYaml,
  insertItem: insertYamlArrayItem,
  replaceItem: replaceYamlArrayItem
}
