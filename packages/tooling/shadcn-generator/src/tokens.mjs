import { transform } from "lightningcss"
import postcss from "postcss"

/** Resolve definitions, never the app's computed styles. Unknown/context-dependent values fail closed. */
export function resolveTokens(definitions, { rootFontSize = 16 } = {}) {
  if (!Number.isFinite(rootFontSize) || rootFontSize <= 0) {
    throw new Error("rootFontSize must be positive")
  }
  const resolved = new Map()
  function resolveReference(name, ancestors = []) {
    if (ancestors.includes(name)) {
      throw new Error(`Cyclic token reference: ${[...ancestors, name].join(" -> ")}`)
    }
    if (!Object.hasOwn(definitions, name)) {
      throw new Error(`Missing token reference: ${name}`)
    }
    if (resolved.has(name)) {
      return resolved.get(name)
    }
    const value = substitute(definitions[name], [...ancestors, name])
    resolved.set(name, value)
    return value
  }
  function substitute(source, ancestors) {
    let value = source
    // Resolve innermost var() calls first, then follow references with cycle detection.
    while (value.includes("var(")) {
      let changed = false
      value = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
        changed = true
        if (Object.hasOwn(definitions, name)) {
          return resolveReference(name, ancestors)
        }
        if (fallback !== undefined) {
          return fallback.trim()
        }
        throw new Error(`Missing token reference: ${name}`)
      })
      if (!changed) {
        throw new Error(`Unsupported variable expression: ${source}`)
      }
    }
    return value
  }
  return Object.fromEntries(
    Object.entries(definitions).map(([name, sourceValue]) => [
      name.replace(/^--/, ""),
      {
        resolvedValue: concreteValue(resolveReference(name), rootFontSize),
        sourceValue
      }
    ])
  )
}

function concreteValue(value, rootFontSize) {
  // Let the CSS compiler evaluate calc() and color spaces instead of duplicating CSS arithmetic/color science.
  if (/^(?:calc\(|min\(|max\(|clamp\(|-?[\d.]+(?:px|rem)$)/.test(value)) {
    const css = transform({
      filename: "token.css",
      code: Buffer.from(`a{border-radius:${value}}`),
      minify: true
    }).code.toString()
    let dimension
    postcss.parse(css).walkDecls("border-radius", (declaration) => {
      dimension = declaration.value
    })
    const match = dimension?.match(/^(-?[\d.]+)(px|rem)$/)
    if (!match) {
      throw new Error(`Token needs layout context or unsupported dimension: ${value}`)
    }
    const pixels = Number(match[1]) * (match[2] === "rem" ? rootFontSize : 1)
    return `${Number(pixels.toFixed(6))}px`
  }
  let firstColor
  const css = transform({
    filename: "token.css",
    code: Buffer.from(`a{color:${value}}`),
    targets: { chrome: 61 * 2 ** 16 },
    minify: true
  }).code.toString()
  postcss.parse(css).walkDecls("color", (declaration) => {
    firstColor ??= declaration.value
  })
  let rgb
  if (firstColor) {
    transform({
      filename: "token.css",
      code: Buffer.from(`a{color:${firstColor}}`),
      visitor: {
        Color(color) {
          if (color.type === "rgb") {
            rgb = color
          }
        }
      }
    })
  }
  if (!rgb) {
    throw new Error(`Unsupported or context-dependent token value: ${value}`)
  }
  // Lightning CSS's RGB AST stores alpha in an 8-bit channel. Preserve the serialized float when available.
  const serializedAlpha = firstColor.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/)?.[1]
  const alpha = Number((serializedAlpha === undefined ? rgb.alpha : Number(serializedAlpha)).toFixed(6))
  if (alpha < 1) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }
  return "#" + [rgb.r, rgb.g, rgb.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")
}

export function designTokens({ style, revision, repository, palette, cssVariables, tailwind }, rootFontSize = 16) {
  const variables = (values) => Object.fromEntries(Object.entries(values).map(([name, value]) => ["--" + name, value]))
  const light = variables({ ...cssVariables.theme, ...cssVariables.light })
  const dark = { ...light, ...variables(cssVariables.dark) }
  return {
    schemaVersion: 1,
    style,
    upstream: { repository, revision },
    palette,
    rootFontSize,
    colorSpace: "srgb",
    light: resolveTokens({ ...light, ...tailwind }, { rootFontSize }),
    dark: resolveTokens({ ...dark, ...tailwind }, { rootFontSize })
  }
}
