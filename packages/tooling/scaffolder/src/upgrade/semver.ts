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
