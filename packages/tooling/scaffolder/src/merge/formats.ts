import { insertJsonArrayItem, parseJsonc, removeJson, replaceJsonArrayItem, setJson } from "../edit/json.js"
import { defaultJsonLayout, type JsonLayout } from "../edit/layout.js"
import { insertYamlArrayItem, parseYaml, removeYaml, replaceYamlArrayItem, setYaml } from "../edit/yaml.js"
import type { DocumentFormat } from "./shared.js"

/** JSON edited by key, laid out as the project's formatter prints it. */
export function jsonFormat(layout: JsonLayout = defaultJsonLayout): DocumentFormat {
  return {
    format: "json",
    emptyText: "{}\n",
    parse: parseJsonc,
    set: (text, path, value) => setJson(text, path, value, layout),
    remove: (text, path) => removeJson(text, path, layout),
    insertItem: (text, path, index, value) => insertJsonArrayItem(text, path, index, value, layout),
    replaceItem: (text, path, index, value) => replaceJsonArrayItem(text, path, index, value, layout)
  }
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
