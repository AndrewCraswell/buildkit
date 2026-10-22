import type { ModalSlotProps, ModalManager } from "@buildkitgg/shadcn-modals-manager"
import { useState } from "react"
import { Button } from "./components/ui/Button"
import { Input } from "./components/ui/Input"

type Project = { name: string }

/** The application owns the fields and save operation; the manager owns the modal lifecycle. */
export function createProjectModal(manager: ModalManager, original: Project, mode: "form" | "retry" | "guard") {
  function ProjectForm({ data, controls, isPending, error }: ModalSlotProps<Project, Project | null>) {
    const [shouldFail, setShouldFail] = useState(mode === "retry")

    return (
      <form
        className="project-modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void controls.submit(async (project) => {
            const name = project.name.trim()
            if (!name) {
              throw new Error("Enter a project name.")
            }
            if (mode === "retry") {
              // A local simulation of an application request, not a manager feature.
              await new Promise((resolve) => setTimeout(resolve, 900))
              if (shouldFail) {
                setShouldFail(false)
                throw new Error("This example's first save fails. Your edits are safe. Try again.")
              }
            }
            return { name }
          })
        }}
      >
        <label htmlFor={`${controls.id}-name`}>Project name</label>
        <Input
          id={`${controls.id}-name`}
          value={data.name}
          required
          maxLength={80}
          disabled={isPending}
          onChange={(event) => controls.update({ data: { name: event.target.value } })}
        />
        {error !== null && (
          <p className="project-modal-error" role="alert">
            {error instanceof Error ? error.message : "Your changes could not be saved."}
          </p>
        )}
        <div className="project-modal-actions">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              void controls.dismiss()
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save project"}
          </Button>
        </div>
      </form>
    )
  }

  return manager.createModal({
    title: "Edit project",
    description:
      mode === "retry"
        ? "The first save simulates a failed request. Save again to retry."
        : "Save to return the updated project. Cancel to leave it unchanged.",
    initialState: { ...original },
    defaultResult: null,
    body: { component: ProjectForm },
    beforeDismiss(project) {
      if (mode !== "guard" || project.name === original.name) {
        return true
      }
      return manager.confirm({
        title: "Discard changes?",
        description: "Your project name has unsaved changes.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing"
      })
    }
  })
}
