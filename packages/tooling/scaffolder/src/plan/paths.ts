const reservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

/**
 * Why a project-relative path is unsafe, or `undefined` when it's fine. Refuses absolute paths, backslashes, drive
 * letters, `.` and `..` segments, control characters, trailing dots or spaces, and Windows reserved names. Names such as
 * `..foo` are allowed. The Node snapshot adds the checks that need a disk: symlinks, hard links and case.
 */
export function pathProblem(path: string): string | undefined {
  if (path.length === 0) {
    return "The path is empty."
  }
  if (path.length > 240) {
    return "The path is longer than 240 characters."
  }
  if (path.startsWith("/")) {
    return "The path is absolute."
  }
  if (path.includes("\\")) {
    return "The path uses a backslash. Use forward slashes."
  }
  if (path.includes(":")) {
    return "The path has a colon, which could name another drive."
  }
  if ([...path].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    return "The path has a control character."
  }
  for (const segment of path.split("/")) {
    if (segment === "") {
      return "The path has an empty segment."
    }
    if (segment === "." || segment === "..") {
      return "The path leaves the project."
    }
    if (/[. ]$/.test(segment)) {
      return `"${segment}" ends with a dot or a space.`
    }
    if (reservedName.test(segment)) {
      return `"${segment}" is a reserved name on Windows.`
    }
  }
  return undefined
}

/** Two paths that differ only in case, which collide on Windows and macOS. */
export function caseCollision(paths: Iterable<string>): [string, string] | undefined {
  const seen = new Map<string, string>()
  for (const path of paths) {
    const key = path.toLowerCase()
    const other = seen.get(key)
    if (other !== undefined && other !== path) {
      return [other, path]
    }
    seen.set(key, path)
  }
  return undefined
}

export function dirname(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

/** A relative module specifier from one project path's folder to another project path. */
export function relativeModule(fromFile: string, toPath: string): string {
  const from = dirname(fromFile).split("/").filter(Boolean)
  const to = toPath.split("/").filter(Boolean)
  let common = 0
  while (common < from.length && common < to.length && from[common] === to[common]) {
    common++
  }
  const up = from.slice(common).map(() => "..")
  const relative = [...up, ...to.slice(common)].join("/")
  // `..foo` is a name, not a parent folder, so it needs `./` too.
  if (relative === ".." || relative.startsWith("../")) {
    return relative
  }
  return relative === "" ? "." : `./${relative}`
}
