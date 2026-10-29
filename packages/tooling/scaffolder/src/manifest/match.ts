import { PlanError } from "../plan/errors.js"

/**
 * Runs the case for `value`, so an add-on branches on a render model or mode without a `switch`. When `value` is a
 * union, a missing case is a type error. When it's a `string`, such as `target.renderModel`, a value no case handles is
 * a plan error, which `checkCatalog(catalog, { matrix: true })` reaches for every mode.
 */
export function match<V extends string, R>(value: V, cases: { readonly [K in V]: () => R }): R {
  if (!Object.hasOwn(cases, value)) {
    throw new PlanError(
      "E_UNSUPPORTED",
      `Nothing handles "${value}". The cases are ${Object.keys(cases)
        .map((key) => `"${key}"`)
        .join(", ")}.`
    )
  }
  return cases[value]()
}
