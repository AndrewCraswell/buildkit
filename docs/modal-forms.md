# Typed modal forms

The same definition API works with the React, shadcn and Fluent managers. The examples below assume the application's
`modals` manager is imported and its renderer is mounted.

## Infer state from defaults

```tsx
const counter = modals.createModal({
  title: "Counter",
  initialState: { count: 0 },
  defaultResult: null,
  render: function Counter({ data, controls }) {
    return (
      <>
        <button onClick={() => controls.update((current) => ({ count: current.count + 1 }))}>
          Count: {data.count}
        </button>
        <button onClick={() => controls.close(data)}>Done</button>
        <button
          onClick={() => {
            void controls.dismiss()
          }}
        >
          Cancel
        </button>
      </>
    )
  }
})

const handle = counter.open({ count: 3 })
handle.update((current) => ({ count: current.count + 1 }))
const result = await handle // { count: number } | null
```

There is no duplicated state interface. `open()` uses all defaults, partial overrides remain typed, and each opening
starts fresh. Use explicit generics when defaults cannot express a union, nullable field or empty array's element type.

## Separate form values from the returned result

```tsx
import type { ModalBodyProps } from "@buildkitgg/react-modals"

type Profile = { name: string; email: string }
type SavedProfile = Profile & { id: number }

function ProfileForm({ data, controls, isPending, error }: ModalBodyProps<Profile, SavedProfile | null>) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void controls.submit((current) => saveProfile(current))
      }}
    >
      <label>
        Name
        <input
          required
          disabled={isPending}
          value={data.name}
          onChange={(event) => controls.update({ name: event.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          required
          disabled={isPending}
          value={data.email}
          onChange={(event) => controls.update({ email: event.target.value })}
        />
      </label>
      {error !== null && <p role="alert">Your changes could not be saved. Try again.</p>}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          void controls.dismiss()
        }}
      >
        Cancel
      </button>
      <button type="submit" disabled={isPending}>
        {isPending ? "Working…" : "Save"}
      </button>
    </form>
  )
}

const original = { name: "Ada", email: "ada@example.com" }
const editProfile = modals.createModal({
  title: "Edit profile",
  initialState: original,
  defaultResult: null,
  render: ProfileForm,
  beforeDismiss: (current) =>
    (current.name === original.name && current.email === original.email) ||
    modals.confirm({ title: "Discard changes?", confirmLabel: "Discard changes", cancelLabel: "Keep editing" })
})
const result = await editProfile.open() // SavedProfile | null
```

`saveProfile` is the application's async function returning `Promise<SavedProfile>`. Submission handles pending state,
duplicate attempts, failure and successful completion. The result is exactly the value returned by that function; the
manager does not collect or serialize fields. Validation and form-library choice remain with the component. A consumer
using React Hook Form or TanStack Form can call `controls.submit(() => saveProfile(validatedValues))` from its submit
callback instead.

See [lifecycle and dismissal rules](modals.md) for teardown, stale results and guard behavior.
