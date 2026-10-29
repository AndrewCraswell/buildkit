interface Version {
  core: [number, number, number]
  prerelease: (number | string)[]
}

function parse(version: string): Version {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim())
  if (!match) {
    throw new Error(`"${version}" isn't a semantic version.`)
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : []
  }
}

/** Compares two semantic versions: negative when `left` is lower, zero when equal, positive when higher. */
export function compareVersions(left: string, right: string): number {
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index++) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return b.prerelease.length - a.prerelease.length
  }
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index++) {
    const x = a.prerelease[index]
    const y = b.prerelease[index]
    if (x === undefined || y === undefined) {
      return x === undefined ? -1 : 1
    }
    if (x !== y) {
      if (typeof x === "number" && typeof y === "number") {
        return x - y
      }
      if (typeof x === "number") {
        return -1
      }
      if (typeof y === "number") {
        return 1
      }
      return x < y ? -1 : 1
    }
  }
  return 0
}

export function isValidVersion(version: string): boolean {
  try {
    parse(version)
    return true
  } catch {
    return false
  }
}

type Comparator = { operator: "<" | "<=" | ">" | ">=" | "="; version: string }

/** `1`, `1.2` and `1.2.3` as a full version, with missing parts as zero, and how many parts were given. */
function partial(text: string): { version: string; parts: number } {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+)(-[0-9A-Za-z.-]+)?)?$/.exec(text)
  if (!match) {
    throw new Error(`"${text}" isn't a version range.`)
  }
  const parts = [match[1], match[2], match[3]].filter((part) => part !== undefined).length
  return { version: `${match[1]}.${match[2] ?? 0}.${match[3] ?? 0}${match[4] ?? ""}`, parts }
}

function comparators(term: string): Comparator[] {
  if (term === "*" || term === "x" || term === "") {
    return []
  }
  const [, operator = "", rest = ""] = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(term) ?? []
  const { version, parts } = partial(rest)
  const [major = 0, minor = 0, patch = 0] = parse(version).core
  if (operator === "^") {
    let upper = `${major + 1}.0.0`
    if (major === 0 && parts > 1) {
      upper = minor === 0 && parts > 2 ? `0.0.${patch + 1}` : `0.${minor + 1}.0`
    }
    return [
      { operator: ">=", version },
      { operator: "<", version: upper }
    ]
  }
  if (operator === "~" || (operator === "" && parts < 3)) {
    const upper = parts === 1 ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`
    return [
      { operator: ">=", version },
      { operator: "<", version: upper }
    ]
  }
  return [{ operator: operator === "" ? "=" : (operator as Comparator["operator"]), version }]
}

/**
 * Whether a version is in an npm-style range: `^1.2.0`, `~1.2.0`, `>=1.0.0 <3.0.0`, `1.2.3`, `*`, joined with `||`.
 * A prerelease is in a range only when the range names a prerelease of the same version.
 */
export function satisfiesRange(version: string, range: string): boolean {
  const candidate = parse(version)
  return range.split("||").some((set) => {
    const terms = set.trim().split(/\s+/).flatMap(comparators)
    if (
      candidate.prerelease.length > 0 &&
      !terms.some((term) => {
        const bound = parse(term.version)
        return bound.prerelease.length > 0 && bound.core.join(".") === candidate.core.join(".")
      })
    ) {
      return false
    }
    return terms.every(({ operator, version: bound }) => {
      const difference = compareVersions(version, bound)
      return {
        "<": difference < 0,
        "<=": difference <= 0,
        ">": difference > 0,
        ">=": difference >= 0,
        "=": difference === 0
      }[operator]
    })
  })
}
