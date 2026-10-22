import { baseUiComponents, createModalManager, ModalRenderer } from "@buildkitgg/shadcn-modals-manager"
import { Archive, ArrowUpRight, Folder, Pencil, RotateCcw } from "lucide-react"
import { useState } from "react"
import { Button } from "./components/ui/Button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./components/ui/Dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/Tabs"
import { createProjectModal } from "./createProjectModal"
import { ExampleCode } from "./ExampleCode"
import { links } from "./links"

const adapter = baseUiComponents({ Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, Button })
const scenarios = [
  {
    id: "confirm",
    label: "Confirm",
    title: "Await a decision",
    description:
      "Open a dialog from an event handler or a service. Confirming returns true; cancelling or pressing Escape returns false. Your code continues when the person decides.",
    hint: "Confirm, cancel, or press Escape. Each path resolves the same promise.",
    code: 'const confirmed = await manager.confirm({\n  title: "Archive this project?",\n  confirmLabel: "Archive project"\n})\n\nif (confirmed) setIsArchived(true)'
  },
  {
    id: "form",
    label: "Typed result",
    title: "Pass state in. Get a typed result back.",
    description:
      "Prefill a modal with your data and await the edited object. State and result types follow your definition. Cancelling returns the default result, null in this example.",
    hint: "Change the name and save. The returned object updates this project.",
    code: 'const edit = manager.createModal({\n  initialState: { name: "Website refresh" },\n  defaultResult: null,\n  body: { component: ProjectForm }\n})\n\nconst project = await edit.open()\n// { name: string } | null'
  },
  {
    id: "retry",
    label: "Save & retry",
    title: "Keep edits when a save fails",
    description:
      "Submit an async action through the modal controls. The manager tracks pending state and errors, blocks duplicate submissions, and closes only when the action succeeds.",
    hint: "The first save deliberately fails. Save again to succeed; no data leaves this page.",
    code: "await controls.submit(async (project) => {\n  return await saveProject(project)\n})\n\n// Use isPending to disable your fields.\n// Render error next to the form.\n// A failed save leaves the modal open."
  },
  {
    id: "guard",
    label: "Unsaved changes",
    title: "Check before discarding edits",
    description:
      "A dismissal guard can await another modal. Cancel, Escape, and outside clicks all use the same guard. Keep editing returns to the form with your changes intact.",
    hint: "Edit the name, then cancel or press Escape to try the nested confirmation.",
    code: 'beforeDismiss(project) {\n  if (project.name === original.name) return true\n\n  return manager.confirm({\n    title: "Discard changes?",\n    confirmLabel: "Discard changes",\n    cancelLabel: "Keep editing"\n  })\n}'
  }
] as const

type ModalScenarioProps = { scenario: (typeof scenarios)[number] }

function ModalScenario({ scenario }: ModalScenarioProps) {
  const [manager] = useState(() => createModalManager({ adapter }))
  const [project, setProject] = useState({ name: "Website refresh" })
  const [isArchived, setIsArchived] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [result, setResult] = useState("Open the example to see its result")

  async function handleOpen() {
    setIsWaiting(true)
    setResult("Waiting for a result…")
    if (scenario.id === "confirm") {
      const confirmed = await manager.confirm({
        title: "Archive this project?",
        description: "This moves the example project to the archive. You can restore it afterwards.",
        confirmLabel: "Archive project"
      })
      setResult(String(confirmed))
      setIsArchived(confirmed)
    } else {
      const edited = await createProjectModal(manager, project, scenario.id).open()
      setResult(JSON.stringify(edited))
      if (edited !== null) {
        setProject(edited)
      }
    }
    setIsWaiting(false)
  }

  return (
    <div className="behavior-example modal-scenario">
      <div className="behavior-explanation">
        <h3>{scenario.title}</h3>
        <p>{scenario.description}</p>
        <a className="text-link" href={`${links.docs}packages/shadcn-modals-manager/`}>
          Modal manager guide <ArrowUpRight aria-hidden="true" />
        </a>
        <ExampleCode label={scenario.id === "retry" ? "ProjectForm.tsx" : "project-modal.tsx"}>
          {scenario.code}
        </ExampleCode>
      </div>
      <div className="behavior-preview modal-preview">
        <div className="demo-toolbar">
          <strong>Projects</strong>
          <span>{scenario.label}</span>
        </div>
        <div className="project-example">
          <span className="project-folder" aria-hidden="true">
            {isArchived ? <Archive /> : <Folder />}
          </span>
          <div className="project-heading">
            <h4>{project.name}</h4>
            <span className="project-status">{isArchived ? "Archived" : "Active"}</span>
          </div>
          <p>A sample project. Changes stay in this example.</p>
          {isArchived ? (
            <Button
              variant="outline"
              onClick={() => {
                setIsArchived(false)
                setResult("Project restored")
              }}
            >
              <RotateCcw aria-hidden="true" /> Restore project
            </Button>
          ) : (
            <Button
              variant="outline"
              aria-haspopup="dialog"
              disabled={isWaiting}
              onClick={() => {
                void handleOpen()
              }}
            >
              {scenario.id === "confirm" ? <Archive aria-hidden="true" /> : <Pencil aria-hidden="true" />}
              {scenario.id === "confirm" ? "Archive project" : "Edit project"}
            </Button>
          )}
        </div>
        <output className="modal-result">
          <span>Returned value</span>
          <code>{result}</code>
        </output>
        <p className="demo-note">{scenario.hint}</p>
      </div>
      <ModalRenderer manager={manager} />
    </div>
  )
}

export function ModalExample() {
  return (
    <article className="modal-examples" aria-labelledby="modal-example-title">
      <h2 id="modal-example-title">Return a result from any modal</h2>
      <Tabs defaultValue="confirm">
        <TabsList className="modal-scenario-tabs" aria-label="Modal behavior">
          {scenarios.map((scenario) => (
            <TabsTrigger key={scenario.id} value={scenario.id}>
              {scenario.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {scenarios.map((scenario) => (
          <TabsContent key={scenario.id} value={scenario.id}>
            <ModalScenario scenario={scenario} />
          </TabsContent>
        ))}
      </Tabs>
    </article>
  )
}
