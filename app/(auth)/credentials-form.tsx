"use client"

import { useId, useState, type SubmitEvent } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth/client"

type CredentialsFormProps =
  { mode: "sign-in" } | { mode: "sign-up"; inviteToken: string }

export function CredentialsForm(props: CredentialsFormProps) {
  const fieldId = useId()
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
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-name`}>Name</Label>
          <Input
            id={`${fieldId}-name`}
            name="name"
            autoComplete="name"
            required
          />
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldId}-email`}>Email</Label>
        <Input
          id={`${fieldId}-email`}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${fieldId}-password`}>Password</Label>
        <Input
          id={`${fieldId}-password`}
          type="password"
          name="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={signingUp ? 8 : undefined}
          required
        />
      </div>
      <Button size="lg" type="submit" disabled={pending}>
        {signingUp ? "Create account" : "Sign in"}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
