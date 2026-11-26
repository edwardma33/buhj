"use client"

import { LogOutIcon } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        className="workspace-nav-control"
        disabled={pending}
        onClick={signOut}
      >
        <LogOutIcon data-icon="inline-start" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>Could not sign out. Try again.</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
