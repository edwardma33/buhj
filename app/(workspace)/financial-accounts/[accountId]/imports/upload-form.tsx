"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { uploadCsv } from "./actions"

export function UploadForm({ accountId }: { accountId: string }) {
  const [error, action, pending] = useActionState(
    uploadCsv.bind(null, accountId),
    ""
  )

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="csv">USD transaction CSV</Label>
        <Input
          id="csv"
          name="csv"
          type="file"
          accept=".csv,text/csv"
          required
          aria-describedby="csv-guidance"
        />
        <p id="csv-guidance" className="text-sm text-muted-foreground">
          Use one signed amount column. Buhj sends OpenAI column headers and a
          sample with cell values masked so Luna can propose a mapping.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Preparing preview…" : "Preview import"}
      </Button>
    </form>
  )
}
