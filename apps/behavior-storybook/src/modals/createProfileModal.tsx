import type { ModalBodyProps, ModalDefinition, ModalManager } from "@buildkitgg/react-modals"
import { useState } from "react"
import type { ComponentType } from "react"
import type { ExampleButtonProps, ExampleInputProps } from "./ModalExamples.js"

type ProfileState = { name: string; email: string }
type SavedProfile = ProfileState & { id: number }
type ProfileComponents = {
  Button: ComponentType<ExampleButtonProps>
  Input: ComponentType<ExampleInputProps>
  onLoadSample(): void
}

/** The form owns fields and validation; the manager owns submission and dismissal. */
export function createProfileModal<TSurface>(
  manager: ModalManager<TSurface>,
  { Button, Input, onLoadSample }: ProfileComponents
): ModalDefinition<ProfileState, SavedProfile | null> {
  const initialState = { name: "Ada", email: "ada@example.com" }

  function ProfileForm({ data, controls, isPending, error }: ModalBodyProps<ProfileState, SavedProfile | null>) {
    const [shouldFail, setShouldFail] = useState(false)
    return (
      <form
        className="modal-example-form"
        onSubmit={(event) => {
          event.preventDefault()
          void controls.submit(async (current) => {
            if (!current.name.trim()) {
              throw new Error("Enter a display name.")
            }
            // Simulate an application request; no timer or network policy lives in the package.
            await new Promise((resolve) => setTimeout(resolve, 1000))
            if (shouldFail) {
              setShouldFail(false)
              throw new Error("Your changes could not be saved. Try again.")
            }
            return { id: 42, name: current.name.trim(), email: current.email }
          })
        }}
      >
        <div className="modal-example-field">
          <label htmlFor={`${controls.id}-name`}>Display name</label>
          <Input
            id={`${controls.id}-name`}
            required
            disabled={isPending}
            value={data.name}
            onChange={(name) => controls.update({ name })}
          />
        </div>
        <div className="modal-example-field">
          <label htmlFor={`${controls.id}-email`}>Email</label>
          <Input
            id={`${controls.id}-email`}
            type="email"
            required
            disabled={isPending}
            value={data.email}
            onChange={(email) => controls.update({ email })}
          />
        </div>
        <div className="actions">
          <Button type="button" disabled={isPending} onClick={onLoadSample}>
            Load sample profile
          </Button>
          <Button type="button" disabled={isPending || shouldFail} onClick={() => setShouldFail(true)}>
            {shouldFail ? "Next save will fail" : "Simulate save failure"}
          </Button>
        </div>
        {error !== null && (
          <p role="alert">{error instanceof Error ? error.message : "Your changes could not be saved."}</p>
        )}
        <div className="actions">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              void controls.dismiss()
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Working…" : "Save profile"}
          </Button>
        </div>
      </form>
    )
  }

  return manager.createModal({
    title: "Edit profile",
    description: "Save to return a typed profile. Cancel to discard changes.",
    initialState,
    defaultResult: null,
    render: ProfileForm,
    beforeDismiss(data) {
      if (data.name === initialState.name && data.email === initialState.email) {
        return true
      }
      return manager.confirm({
        title: "Discard changes?",
        description: "Your profile changes have not been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing"
      })
    }
  })
}
