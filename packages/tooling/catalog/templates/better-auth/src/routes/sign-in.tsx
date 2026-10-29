import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState, type FormEvent } from "react"
import { authClient } from "../auth/client"
import { getViewer } from "../auth/viewer.functions"

export const Route = createFileRoute("/sign-in")({
  loader: () => getViewer(),
  head: () => ({ meta: [{ title: "Sign in" }] }),
  component: SignIn
})

type Mode = "sign-in" | "sign-up"

function SignIn() {
  const viewer = Route.useLoaderData()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name, email, password })
      if (result.error) {
        setError(result.error.message ?? "That didn’t work. Check your details and try again.")
        return
      }
      // Loaders run again, so every route sees the new session.
      await router.invalidate()
    } catch {
      setError("That didn’t work. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    await router.invalidate()
  }

  if (viewer) {
    return (
      <main className="page">
        <h1>You’re signed in</h1>
        <p>Signed in as {viewer.name ?? "you"}.</p>
        <button type="button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </main>
    )
  }

  const describedBy = error ? "sign-in-error" : undefined
  return (
    <main className="page">
      <h1>{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        {mode === "sign-up" && (
          <>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </>
        )}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={describedBy}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby={describedBy}
        />
        {error && (
          <p id="sign-in-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" aria-disabled={busy}>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button type="button" className="link-button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
        {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  )
}
