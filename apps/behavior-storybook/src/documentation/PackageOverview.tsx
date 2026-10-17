import { Documentation, Code, StoryLink } from "./Documentation.js"
import { packages } from "./packages.js"
export function PackageOverview({ name }: { name: (typeof packages)[number]["name"] }) {
  const entry = packages.find((item) => item.name === name)
  if (!entry) {
    throw new Error("Unknown package")
  }
  return (
    <Documentation title={`@buildkitgg/${entry.name}`} summary={entry.summary}>
      <h2>Usage</h2>
      <Code>{entry.code}</Code>
      <h2>API at a glance</h2>
      <ul>
        {entry.api.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>Integration notes</h2>
      <p>{entry.notes}</p>
      <p>
        <StoryLink id={entry.example}>Explore the interactive example</StoryLink>
      </p>
      <p>
        <a href={`https://github.com/AndrewCraswell/buildkit/tree/main/packages/${entry.name}`}>
          Package source and README
        </a>
      </p>
    </Documentation>
  )
}
