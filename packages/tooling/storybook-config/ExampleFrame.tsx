import type { ReactNode } from "react"
import "./examples.css"
export type ExampleFrameProps = {
  group: string
  title: string
  description?: string
  code?: string
  catalog?: boolean
  children: ReactNode
}
export function ExampleFrame({ group, title, description, code, catalog, children }: ExampleFrameProps) {
  return (
    <main className="bk-example">
      <header className="bk-example-heading">
        <p className="bk-example-path">{group.replaceAll("/", " / ")}</p>
        <h1>{title}</h1>
        {description && <p className="bk-example-description">{description}</p>}
      </header>
      <section
        className={catalog ? "bk-example-preview bk-catalog-preview" : "bk-example-preview"}
        aria-label={title + " example"}
      >
        <div className="bk-example-toolbar">
          <span>Preview</span>
          <span>{catalog ? "Component" : "Interactive example"}</span>
        </div>
        <div className="bk-example-canvas">{children}</div>
      </section>
      {code && (
        <details className="bk-example-source">
          <summary>View implementation</summary>
          <pre>
            <code>{code}</code>
          </pre>
        </details>
      )}
    </main>
  )
}
export function ExampleResult({ label = "Result", children }: { label?: string; children: ReactNode }) {
  return (
    <div className="bk-example-result">
      <span>{label}</span>
      <output aria-live="polite">{children}</output>
    </div>
  )
}
