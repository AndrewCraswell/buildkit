import type { Envelope } from "../plan/envelope.js"

const classLabels: Record<string, string> = {
  owned: "generated",
  seed: "starter, merged on upgrade",
  sample: "starter, written once",
  shared: "config, edited by key",
  user: "yours",
  config: "project config",
  lock: "lock"
}

function headline(envelope: Envelope): string {
  const count = envelope.operations?.length ?? 0
  const changes = `${count} ${count === 1 ? "change" : "changes"}`
  switch (envelope.status) {
    case "planned":
      return `Planned ${changes}. Nothing has been written yet.`
    case "applied":
      return `Applied ${changes}.`
    case "unchanged":
      return "Everything is up to date. Nothing to change."
    case "needs-decision":
      return "This needs your decision. Nothing has been written."
    case "conflict":
      return "Some changes conflict with your edits. Nothing has been written."
    case "error":
      return `Error: ${envelope.error?.message ?? "Something went wrong."}`
  }
}

function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : ["", `${title}:`, ...lines.map((line) => `  ${line}`)]
}

function describePackage(change: NonNullable<Envelope["packages"]>[number]): string {
  if (change.to === undefined) {
    return `remove ${change.name} from ${change.section}`
  }
  if (change.from === undefined) {
    return `add ${change.name}@${change.to} to ${change.section}`
  }
  return `update ${change.name} from ${change.from} to ${change.to}`
}

/** Readable text for a terminal. Agents and scripts use `--json` instead. */
export function describeEnvelope(envelope: Envelope): string {
  const lines = [headline(envelope)]
  lines.push(
    ...section(
      "Changes",
      (envelope.operations ?? []).map((operation) => {
        const counts = operation.secret ? "contents hidden" : `+${operation.linesAdded} -${operation.linesRemoved}`
        return `${operation.action.padEnd(6)} ${operation.path} (${classLabels[operation.class] ?? operation.class}, ${counts})`
      })
    ),
    ...section("Always included", envelope.required ?? []),
    ...section(
      "Also adds",
      (envelope.pulled ?? []).map((pulled) => `${pulled.id}, needed by ${pulled.by.join(", ")}`)
    ),
    ...section(
      "Packages",
      (envelope.packages ?? []).map((change) => describePackage(change))
    ),
    ...section(
      "Environment variables",
      (envelope.env ?? []).map(
        (variable) =>
          `${variable.name} (${variable.scope}${variable.secret ? ", secret" : ""}${variable.required ? ", required" : ""}): ${variable.description}`
      )
    ),
    ...section(
      "Upgrades",
      envelope.upgrade
        ? [
            `catalog ${envelope.upgrade.catalog.from} to ${envelope.upgrade.catalog.to}`,
            ...envelope.upgrade.addons.map(
              (addon) => `${addon.id} ${addon.from ?? "(new)"} to ${addon.to ?? "(removed)"}`
            )
          ]
        : []
    ),
    ...section(
      "Migrations",
      (envelope.migrations ?? []).map(
        (migration) =>
          `${migration.id} (${migration.kind}): ${migration.description}${migration.prompt ? `\n    Task: ${migration.prompt}` : ""}`
      )
    ),
    ...section(
      "Merged",
      (envelope.merged ?? []).map(
        (merged) =>
          `${merged.path}: ${merged.hunks} ${merged.hunks === 1 ? "change" : "changes"} merged with your edits`
      )
    ),
    ...section(
      "Decisions",
      (envelope.decisions ?? []).flatMap((decision) => [
        decision.message,
        ...decision.choices.map((choice) => `  ${choice.label}: ${choice.argv.join(" ")}`)
      ])
    ),
    ...section(
      "Conflicts",
      (envelope.conflicts ?? []).flatMap((conflict) => [
        `${conflict.path}: ${conflict.message}`,
        `  Resolve with --resolve "${conflict.id}=${conflict.resolutions.map((resolution) => (resolution === "file" ? "file:<path>" : resolution)).join("|")}"`
      ])
    ),
    ...section(
      "Run after applying",
      (envelope.commands ?? []).map((command) => `${command.run}: ${command.why}`)
    ),
    ...section(
      "Notes",
      (envelope.notices ?? []).map((notice) => notice.text)
    ),
    ...section("Next steps", [...(envelope.nextSteps ?? []), ...(envelope.error?.next ?? [])]),
    ...(envelope.artifacts ? ["", `Plan files: ${envelope.artifacts}`] : [])
  )
  return `${lines.join("\n")}\n`
}
