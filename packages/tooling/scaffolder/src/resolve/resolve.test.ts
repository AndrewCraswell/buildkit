import { describe, expect, it } from "vitest"
import { z } from "zod"
import { defineAddon } from "../manifest/define.js"
import type { CatalogManifest } from "../manifest/types.js"
import { PlanError } from "../plan/errors.js"
import { addRequest, applyFixture, fixtureCatalog, initRequest, planFixture } from "../testing/fixture.js"
import { selectionFromAnswers } from "./answers.js"
import { checkCatalog, pairwiseAnswers } from "./check.js"
import { describeCatalog, optionQuestions, templateQuestions } from "./questions.js"
import { projectNameProblem, resolveSelection, type Selection } from "./resolve.js"

const base: Selection = { name: "demo", template: "app", target: { id: "web", mode: "ssr" }, addons: {}, declined: [] }

function thrown(run: () => unknown): PlanError {
  try {
    run()
  } catch (error) {
    if (error instanceof PlanError) {
      return error
    }
    throw error
  }
  throw new Error("expected a PlanError")
}

function withAddons(catalog: CatalogManifest, ...addons: ReturnType<typeof defineAddon>[]): CatalogManifest {
  return { ...catalog, addons: [...catalog.addons, ...addons] }
}

describe("resolveSelection", () => {
  it("rejects unknown add-ons with suggestions, and requires cycles", () => {
    const unknown = thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/i18": {} } }))
    expect(unknown.code).toBe("E_UNKNOWN_ADDON")
    expect(unknown.next).toEqual(["@fixture/i18n"])
    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/a",
        version: "1.0.0",
        title: "A",
        description: "",
        requires: ["@x/b"],
        contribute: () => []
      }),
      defineAddon({
        id: "@x/b",
        version: "1.0.0",
        title: "B",
        description: "",
        requires: ["@x/a"],
        contribute: () => []
      })
    )
    expect(thrown(() => resolveSelection(catalog, { ...base, addons: { "@x/a": {} } })).code).toBe("E_CYCLE")
  })

  it("resolves each required add-on once, before its dependents, and reports who pulled it in", () => {
    const result = resolveSelection(fixtureCatalog(), {
      ...base,
      addons: { "@fixture/auth": {}, "@fixture/db-sqlite": {}, "@fixture/i18n": {} }
    })
    if (!result.ok) {
      throw new Error("expected a selection")
    }
    const ids = result.value.addons.map((addon) => addon.manifest.id)
    expect(ids.filter((id) => id === "@fixture/sessions")).toHaveLength(1)
    expect(ids.indexOf("@fixture/sessions")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(ids.indexOf("@fixture/db-sqlite")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(ids.indexOf("@fixture/i18n")).toBeLessThan(ids.indexOf("@fixture/auth"))
    expect(result.value.addons.find((addon) => addon.manifest.id === "@fixture/sessions")).toMatchObject({
      explicit: false,
      by: ["@fixture/auth"]
    })
  })

  it("asks which add-on fills a required slot, filtered by support", () => {
    const result = resolveSelection(fixtureCatalog(), {
      ...base,
      target: { id: "web", mode: "spa" },
      addons: { "@fixture/auth": {} }
    })
    expect(result).toEqual({
      ok: false,
      issue: { kind: "choose-slot", slot: "database", by: "@fixture/auth", candidates: ["@fixture/db-sqlite"] }
    })
  })

  it("asks for a provider, and allows one add-on per slot", () => {
    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/translate",
        version: "1.0.0",
        title: "Translate",
        description: "",
        requires: ["provides:i18n"],
        contribute: () => []
      })
    )
    expect(resolveSelection(catalog, { ...base, addons: { "@x/translate": {} } })).toMatchObject({
      ok: false,
      issue: { kind: "choose-provider", candidates: ["@fixture/i18n"] }
    })
    expect(
      resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/db-sqlite": {}, "@fixture/db-postgres": {} } })
    ).toMatchObject({
      ok: false,
      issue: { kind: "slot-taken", slot: "database" }
    })
  })

  it("reports add-ons that conflict", () => {
    const catalog = withAddons(
      fixtureCatalog(),
      defineAddon({
        id: "@x/no-i18n",
        version: "1.0.0",
        title: "No i18n",
        description: "",
        conflicts: ["@fixture/i18n"],
        contribute: () => []
      })
    )
    expect(resolveSelection(catalog, { ...base, addons: { "@x/no-i18n": {}, "@fixture/i18n": {} } })).toMatchObject({
      ok: false,
      issue: { kind: "conflicts", addon: "@x/no-i18n", other: "@fixture/i18n" }
    })
  })

  it("supports() returning true allows the add-on, and a string is E_UNSUPPORTED", () => {
    expect(resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/db-postgres": {} } }).ok).toBe(true)
    const error = thrown(() =>
      resolveSelection(fixtureCatalog(), {
        ...base,
        target: { id: "web", mode: "spa" },
        addons: { "@fixture/db-postgres": {} }
      })
    )
    expect(error.code).toBe("E_UNSUPPORTED")
    expect(error.message).toContain("Postgres needs a server.")
  })

  it("invalid options and unsafe project names are E_INVALID_OPTIONS", () => {
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/ui-fancy": { theme: "neon" } } }))
        .code
    ).toBe("E_INVALID_OPTIONS")
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, addons: { "@fixture/storybook": { extra: true } } }))
        .code
    ).toBe("E_INVALID_OPTIONS")
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, name: "../escape" })).code).toBe(
      "E_INVALID_OPTIONS"
    )
    expect(projectNameProblem("My App")).toBeDefined()
    expect(projectNameProblem("node_modules")).toBeDefined()
    expect(projectNameProblem("@scope/app")).toBeUndefined()
    expect(projectNameProblem("-rf")).toBeDefined()
    expect(projectNameProblem("~app")).toBeDefined()
    expect(projectNameProblem("@-x/app")).toBeDefined()
  })

  it("rejects unknown templates, targets and modes", () => {
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, template: "nope" })).code).toBe(
      "E_UNKNOWN_TEMPLATE"
    )
    expect(
      thrown(() => resolveSelection(fixtureCatalog(), { ...base, target: { id: "nope", mode: "ssr" } })).code
    ).toBe("E_UNKNOWN_TARGET")
    expect(thrown(() => resolveSelection(fixtureCatalog(), { ...base, target: { id: "web", mode: "rsc" } })).code).toBe(
      "E_UNKNOWN_TARGET"
    )
  })
})

describe("templates and answers", () => {
  const catalog = fixtureCatalog()

  it("includes required add-ons without a question, and takes defaults for unanswered ones", () => {
    const result = selectionFromAnswers(catalog, { template: "app", mode: "ssr" }, "demo")
    expect(result).toEqual({
      ok: true,
      selection: {
        name: "demo",
        template: "app",
        target: { id: "web", mode: "ssr" },
        addons: { "@fixture/lint": {}, "@fixture/db-sqlite": {}, "@fixture/ui-basic": {}, "@fixture/storybook": {} },
        declined: ["@fixture/i18n", "@fixture/sentry"]
      }
    })
  })

  it("answers slots with short names, says no to optional slots, and lists exact optional add-ons", () => {
    const result = selectionFromAnswers(
      catalog,
      {
        template: "app",
        mode: "ssr",
        slots: { database: null, ui: "ui-fancy" },
        optional: ["i18n"],
        options: { "ui-fancy": { theme: "dark" } }
      },
      "demo"
    )
    expect(result).toMatchObject({
      ok: true,
      selection: {
        addons: { "@fixture/lint": {}, "@fixture/ui-fancy": { theme: "dark" }, "@fixture/i18n": {} },
        declined: ["@fixture/sentry", "@fixture/storybook", "slot:database"]
      }
    })
  })

  it("asks for the mode when the template has more than one", () => {
    expect(selectionFromAnswers(catalog, { template: "app" }, "demo")).toEqual({
      ok: false,
      issue: { kind: "choose-mode", template: "app", modes: ["ssr", "spa"] }
    })
    expect(selectionFromAnswers(catalog, { template: "bare", slots: { ui: "ui-basic" } }, "demo").ok).toBe(true)
  })

  it("a required slot with no default and more than one choice needs a decision; one fitting choice is taken", () => {
    expect(selectionFromAnswers(catalog, { template: "bare" }, "demo")).toEqual({
      ok: false,
      issue: { kind: "choose-slot", slot: "ui", candidates: ["@fixture/ui-basic", "@fixture/ui-fancy"] }
    })
    const spaOnly = {
      ...catalog,
      templates: catalog.templates.map((template) =>
        template.id === "bare"
          ? { ...template, modes: ["spa"], slots: { database: { required: true as const } } }
          : template
      )
    }
    expect(selectionFromAnswers(spaOnly, { template: "bare" }, "demo")).toMatchObject({
      ok: true,
      selection: { addons: { "@fixture/db-sqlite": {} } }
    })
  })

  it("rejects answers that don't fit the template", () => {
    expect(thrown(() => selectionFromAnswers(catalog, { template: "nope" }, "demo")).code).toBe("E_UNKNOWN_TEMPLATE")
    expect(thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "rsc" }, "demo")).code).toBe("E_USAGE")
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "ssr", slots: { ui: null } }, "demo")).code
    ).toBe("E_USAGE")
    expect(
      thrown(() =>
        selectionFromAnswers(catalog, { template: "app", mode: "ssr", slots: { database: "ui-fancy" } }, "demo")
      ).code
    ).toBe("E_USAGE")
    expect(
      thrown(() => selectionFromAnswers(catalog, { template: "app", mode: "ssr", slots: { nope: "x" } }, "demo")).code
    ).toBe("E_USAGE")
    expect(
      thrown(() =>
        selectionFromAnswers(
          catalog,
          { template: "app", mode: "ssr", options: { "@fixture/i18n": { locales: [] } } },
          "demo"
        )
      ).code
    ).toBe("E_USAGE")
  })
})

describe("plan decisions", () => {
  it("re-adding an installed add-on is unchanged, and filling an empty slot isn't a replace", async () => {
    const files = await applyFixture({}, initRequest({ slots: { database: null } }))
    expect((await planFixture(files, addRequest(["storybook"]))).status).toBe("unchanged")
    const filled = await planFixture(files, addRequest(["db-postgres"]))
    expect(filled.status).toBe("planned")
    expect(filled.operations.find((operation) => operation.path === "fixture.jsonc")?.content).not.toContain(
      "slot:database"
    )
  })

  it("every needs-decision choice carries a complete request that resolves without asking again", async () => {
    const files = await applyFixture({}, initRequest())
    const taken = await planFixture(files, addRequest(["db-postgres"]))
    expect(taken.status).toBe("needs-decision")
    for (const choice of taken.decisions.flatMap((decision) => decision.choices)) {
      expect((await planFixture(files, choice.request)).status).toBe("planned")
    }
    const mode = await planFixture({}, { intent: { command: "init", answers: { template: "app", name: "demo" } } })
    expect(mode.decisions[0]?.choices.map((choice) => choice.id)).toEqual(["ssr", "spa"])
    for (const choice of mode.decisions[0]?.choices ?? []) {
      expect((await planFixture({}, choice.request)).status).toBe("planned")
    }
    const slotless = await applyFixture({}, initRequest({ slots: { database: null } }))
    const question = await planFixture(slotless, addRequest(["database"]))
    expect(question.decisions[0]).toMatchObject({ id: "slot:database", message: "Which database?" })
    for (const choice of question.decisions[0]?.choices ?? []) {
      expect(choice.request.intent).toMatchObject({ command: "add", addons: [choice.id] })
      expect((await planFixture(slotless, choice.request)).status).toBe("planned")
    }
    const auth = await planFixture(slotless, addRequest(["auth"]))
    expect(auth.decisions[0]?.message).toBe("Auth needs a database. Which database?")
  })

  it("validates --replace: unknown add-ons get suggestions, and the target can't change", async () => {
    const files = await applyFixture({}, initRequest())
    expect((await planFixture(files, addRequest(["db-postgres"], ["db-sqlit"]))).error).toMatchObject({
      code: "E_UNKNOWN_ADDON",
      next: ["@fixture/db-sqlite"]
    })
    expect((await planFixture(files, addRequest(["db-postgres"], ["web"]))).error?.code).toBe("E_USAGE")
    expect((await planFixture(files, addRequest(["i18n"], ["db-sqlite"]))).error?.code).toBe("E_USAGE")
    expect((await planFixture(files, addRequest(["db-postgres"], ["i18n"]))).error?.code).toBe("E_USAGE")
  })

  it("offers only supported alternatives in a decision", async () => {
    const files = await applyFixture({}, initRequest({ mode: "spa", slots: { database: null } }))
    const decision = await planFixture(files, addRequest(["database"]))
    expect(decision.status).toBe("planned")
    expect(decision.operations.map((operation) => operation.path)).toContain("src/db/schema.ts")
  })
})

describe("questions and catalog CI", () => {
  const catalog = fixtureCatalog()

  it("describes each template's questions in wizard order", () => {
    const template = catalog.templates[0]
    if (!template) {
      throw new Error("missing template")
    }
    const spa = templateQuestions(catalog, template, "spa")
    expect(spa.required.map((choice) => choice.id)).toEqual(["@fixture/lint"])
    expect(
      spa.slots.map((slot) => [
        slot.slot,
        slot.question,
        slot.required,
        slot.default,
        slot.choices.map((choice) => choice.id)
      ])
    ).toEqual([
      ["database", "Add a database?", false, "@fixture/db-sqlite", ["@fixture/db-sqlite"]],
      ["ui", undefined, true, "@fixture/ui-basic", ["@fixture/ui-basic", "@fixture/ui-fancy"]]
    ])
    expect(spa.optional.map((choice) => [choice.id, choice.default])).toEqual([
      ["@fixture/i18n", false],
      ["@fixture/storybook", true],
      ["@fixture/sentry", false]
    ])
    const description = describeCatalog(catalog)
    expect(Object.keys(description.templates[0]?.questionsByMode ?? {})).toEqual(["ssr", "spa"])
    expect(description.addons.find((addon) => addon.id === "@fixture/i18n")?.ask).toEqual([
      {
        addon: "@fixture/i18n",
        key: "locales",
        title: "Locales",
        schema: expect.objectContaining({ type: "array" }),
        default: ["en"]
      }
    ])
    expect(description.presets).toEqual([
      {
        id: "saas",
        title: "SaaS",
        template: "app",
        answers: {
          template: "app",
          mode: "ssr",
          slots: { database: "@fixture/db-postgres" },
          optional: ["@fixture/i18n"]
        }
      }
    ])
  })

  it("passes for the fixture catalog, including every pair of answers", () => {
    expect(checkCatalog(catalog, { matrix: true })).toEqual([])
    expect(pairwiseAnswers(catalog, "app", "ssr").length).toBeGreaterThan(10)
    expect(pairwiseAnswers(catalog, "nope", "ssr")).toEqual([])
  })

  it("reports broken references, defaults and options", () => {
    const broken: CatalogManifest = {
      ...catalog,
      version: "one",
      targets: [
        ...catalog.targets,
        {
          ...(catalog.targets[0] ?? { id: "", title: "", description: "", family: "", modes: [], base: () => [] }),
          id: "empty",
          modes: [{ id: "x", title: "X", renderModel: "spa", facets: ["webgl"] }]
        }
      ],
      addons: [
        ...catalog.addons,
        defineAddon({
          id: "@x/bad",
          version: "1.0.0",
          title: "Bad",
          description: "",
          slot: "nope",
          requires: ["@x/missing", "slot:nope", "provides:nope"],
          conflicts: ["slot:database"],
          after: ["provides:i18n"],
          ask: ["missing"],
          options: z.object({ needed: z.string() }),
          migrations: [
            { version: "9.0.0", kind: "agent", description: "" },
            { version: "x", kind: "agent", description: "" }
          ],
          contribute: () => []
        }),
        defineAddon({ id: "@x/bad", version: "1", title: "Duplicate", description: "", contribute: () => [] })
      ],
      templates: [
        ...catalog.templates,
        {
          id: "broken",
          title: "Broken",
          description: "",
          target: "web",
          modes: ["ssr", "rsc"],
          required: ["@x/missing"],
          slots: { nope: { required: false, default: "@fixture/i18n" } }
        },
        {
          id: "needs-default",
          title: "Needs default",
          description: "",
          target: "web",
          required: ["@x/bad"],
          optional: { "@fixture/db-postgres": { default: false } },
          slots: { database: { required: false, default: "@fixture/i18n" } }
        },
        { id: "lost", title: "Lost", description: "", target: "nowhere" }
      ],
      presets: [{ id: "orphan", title: "Orphan", answers: { template: "nope" } }]
    }
    const problems = checkCatalog(broken)
    const missing = [
      "uses slot:database in conflicts or after",
      "uses provides:i18n in conflicts or after",
      "isn't a semantic version",
      "More than one add-on has the id @x/bad",
      "uses facet webgl",
      "fills slot nope",
      "refers to @x/missing",
      "refers to slot:nope",
      "refers to provides:nope",
      "asks about option missing",
      "newer than the add-on",
      "offers mode rsc",
      "names required add-on @x/missing",
      "asks about slot nope",
      "every option needs a default",
      "doesn't support web/spa",
      "isn't one of that slot's add-ons",
      "uses target nowhere",
      "Preset orphan"
    ].filter((expected) => !problems.some((problem) => problem.includes(expected)))
    expect(missing).toEqual([])
  })

  it("lists the options an add-on asks about", () => {
    const fancy = catalog.addons.find((addon) => addon.id === "@fixture/ui-fancy")
    expect(fancy && optionQuestions(fancy)).toEqual([
      {
        addon: "@fixture/ui-fancy",
        key: "theme",
        title: "Theme",
        schema: expect.objectContaining({ enum: ["light", "dark"] }),
        default: "light"
      }
    ])
  })
})
