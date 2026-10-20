import { Code2 } from "lucide-react"
import type { ReactNode } from "react"

type ExampleCodeProps = { label: string; children: ReactNode }

export function ExampleCode({ label, children }: ExampleCodeProps) {
  return (
    <div className="example-code dark">
      <div className="example-code-label">
        <Code2 aria-hidden="true" />
        {label}
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Allows keyboard scrolling of long code lines. */}
      <pre tabIndex={0} aria-label={label}>
        <code>{children}</code>
      </pre>
    </div>
  )
}
