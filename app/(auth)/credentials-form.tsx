"use client"

import { useState, type SubmitEvent } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

type CredentialsFormProps =
  { mode: "sign-in" } | { mode: "sign-up"; inviteToken: string }

const inputClass = "rounded-md border border-input bg-background px-3 py-2"

export function CredentialsForm(props: CredentialsFormProps) {
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const signingUp = props.mode === "sign-up"

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const form = new FormData(event.currentTarget)
    const credentials = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    }

    setError("")
    setPending(true)
    const fallback = signingUp
      ? "Could not create your account. Try again."
      : "Could not sign in. Try again."

    try {
      const result = signingUp
        ? await authClient.signUp.email(
            { ...credentials, name: String(form.get("name")).trim() },
            { body: { inviteToken: props.inviteToken } }
          )
        : await authClient.signIn.email(credentials)

      if (!result.error) {
        window.location.replace("/")
        return
      }
      setError(result.error.message || fallback)
    } catch {
      setError(fallback)
    }
    setPending(false)
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-4">
      {signingUp && (
        <label className="grid gap-1.5">
          Name
          <input
            className={inputClass}
            name="name"
            autoComplete="name"
            required
          />
        </label>
      )}
      <label className="grid gap-1.5">
        Email
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="grid gap-1.5">
        Password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={signingUp ? 8 : undefined}
          required
        />
      </label>
      <Button size="lg" type="submit" disabled={pending}>
        {signingUp ? "Create account" : "Sign in"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
