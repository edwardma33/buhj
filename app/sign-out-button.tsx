"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

export function SignOutButton() {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function signOut() {
    setPending(true)
    setFailed(false)
    try {
      const { error } = await authClient.signOut()
      if (error) {
        setFailed(true)
        return
      }
      window.location.replace("/sign-in")
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={signOut}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {failed && <p role="alert">Could not sign out. Try again.</p>}
    </div>
  )
}
