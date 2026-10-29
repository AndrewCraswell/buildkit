import { PlanError } from "../plan/errors.js"

export interface FlagSpec {
  /** Flags that take no value. */
  booleans?: readonly string[]
  /** Flags that take one value. The last one wins. */
  strings?: readonly string[]
  /** Flags that can repeat, and take comma-separated values. */
  lists?: readonly string[]
  /** Flags that can repeat, kept as given: `--set i18n.locales=en,fr`. */
  repeats?: readonly string[]
  /** Flags whose value is optional: `--out` or `--out <folder>`. */
  optionalValues?: readonly string[]
  /** Catalog-defined flags, such as one per slot. Each accepts `--name <value>` and `--no-name`. */
  dynamic?: readonly string[]
}

export interface ParsedFlags {
  positionals: string[]
  booleans: Set<string>
  strings: Map<string, string>
  lists: Map<string, string[]>
  /** `--<name> <value>` gives the value, and `--no-<name>` gives `null`. */
  dynamic: Map<string, string | null>
}

/** Parses arguments by hand, because citty keeps only the last value of a repeated flag. */
export function parseFlags(argv: readonly string[], spec: FlagSpec): ParsedFlags {
  const result: ParsedFlags = {
    positionals: [],
    booleans: new Set(),
    strings: new Map(),
    lists: new Map(),
    dynamic: new Map()
  }
  const has = (list: readonly string[] | undefined, name: string) => list?.includes(name) ?? false
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? ""
    if (argument === "--") {
      result.positionals.push(...argv.slice(index + 1))
      break
    }
    if (!argument.startsWith("--")) {
      if (argument.startsWith("-") && argument.length > 1) {
        if (argument === "-y") {
          result.booleans.add("yes")
          continue
        }
        throw new PlanError("E_USAGE", `Unknown option ${argument}.`)
      }
      result.positionals.push(argument)
      continue
    }
    const equals = argument.indexOf("=")
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals)
    const inline = equals === -1 ? undefined : argument.slice(equals + 1)
    const value = () => {
      if (inline !== undefined) {
        return inline
      }
      const next = argv[index + 1]
      if (next === undefined || next.startsWith("--")) {
        throw new PlanError("E_USAGE", `--${name} needs a value.`)
      }
      index++
      return next
    }
    if (name.startsWith("no-") && has(spec.dynamic, name.slice(3))) {
      result.dynamic.set(name.slice(3), null)
    } else if (has(spec.booleans, name)) {
      if (inline !== undefined) {
        throw new PlanError("E_USAGE", `--${name} doesn't take a value.`)
      }
      result.booleans.add(name)
    } else if (has(spec.optionalValues, name)) {
      let given = inline
      const next = argv[index + 1]
      if (given === undefined && next !== undefined && !next.startsWith("-")) {
        given = next
        index++
      }
      result.strings.set(name, given ?? "")
    } else if (has(spec.strings, name)) {
      result.strings.set(name, value())
    } else if (has(spec.lists, name)) {
      const values = value()
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
      result.lists.set(name, [...(result.lists.get(name) ?? []), ...values])
    } else if (has(spec.repeats, name)) {
      result.lists.set(name, [...(result.lists.get(name) ?? []), value()])
    } else if (has(spec.dynamic, name)) {
      result.dynamic.set(name, value())
    } else {
      throw new PlanError("E_USAGE", `Unknown option --${name}.`)
    }
  }
  return result
}

/** Parses `--set <addon>.<key>=<value>`. Values that read as JSON are parsed; anything else is a string. */
export function parseSet(entries: readonly string[]): { addon: string; key: string; value: unknown }[] {
  return entries.map((entry) => {
    const equals = entry.indexOf("=")
    const path = equals === -1 ? "" : entry.slice(0, equals)
    const dot = path.indexOf(".")
    if (equals === -1 || dot <= 0 || dot === path.length - 1) {
      throw new PlanError(
        "E_USAGE",
        `--set takes <add-on>.<option>=<value>, such as i18n.locales=en,fr. "${entry}" isn't that.`
      )
    }
    return { addon: path.slice(0, dot), key: path.slice(dot + 1), value: parseValue(entry.slice(equals + 1)) }
  })
}

function parseValue(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    return raw.includes(",") ? raw.split(",").map((part) => part.trim()) : raw
  }
}
