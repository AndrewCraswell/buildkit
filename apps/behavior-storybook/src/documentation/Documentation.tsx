import type { ReactNode } from "react"
import "./documentation.css"

export function Documentation({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <article className="bk-docs">
      <header>
        <p className="bk-eyebrow">BUILDKIT / DOCUMENTATION</p>
        <h1>{title}</h1>
        <p className="bk-summary">{summary}</p>
      </header>
      {children}
      <footer>
        <a href="https://github.com/AndrewCraswell/buildkit">Source on GitHub</a>
        <a href="https://github.com/AndrewCraswell/buildkit/issues">Report an issue</a>
      </footer>
    </article>
  )
}
export function Code({ children }: { children: string }) {
  return (
    <pre>
      <code>{children}</code>
    </pre>
  )
}
export function StoryLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a href={`./?path=/story/${id}`} target="_top">
      {children}
    </a>
  )
}
