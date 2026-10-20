import type { ReactNode } from "react"
import { Documentation, Code, StoryLink } from "./Documentation.js"
import { packages } from "./packages.js"
export function PackageOverview({ name, children }: { name: (typeof packages)[number]["name"]; children?: ReactNode }) {
  const entry = packages.find((item) => item.name === name)
  if (!entry) {
    throw new Error("Unknown package")
  }
  return (
    <Documentation title={`@buildkitgg/${entry.name}`} summary={entry.summary}>
      <div className="bk-doc-links">
        <StoryLink id={entry.example}>
          Open example <span aria-hidden="true">↗</span>
        </StoryLink>
        <a
          href={`https://github.com/AndrewCraswell/buildkit/tree/main/packages/${{ Core: "core", React: "react", shadcn: "shadcn", "Fluent UI": "fluentui", Tooling: "tooling" }[entry.group]}/${entry.name}`}
        >
          Source & README
        </a>
      </div>
      <h2>Usage</h2>
      <Code>{entry.code}</Code>
      <h2>API at a glance</h2>
      <dl className="bk-api-list">
        {entry.api.map((item) => {
          const split = item.indexOf(":")
          return (
            <div key={item}>
              <dt>{split < 0 ? item : item.slice(0, split)}</dt>
              <dd>{split < 0 ? "" : item.slice(split + 1).trim()}</dd>
            </div>
          )
        })}
      </dl>
      <h2>Integration notes</h2>
      <p>{entry.notes}</p>
      {children}
    </Documentation>
  )
}
