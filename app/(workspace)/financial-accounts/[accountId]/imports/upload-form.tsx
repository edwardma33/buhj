"use client"

import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import {
  startTransition,
  useActionState,
  useState,
  type SubmitEvent,
} from "react"

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
  const [filename, setFilename] = useState("")
  const [showError, setShowError] = useState(true)
  const displayedError = showError && !pending ? error : ""

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const data = new FormData(event.currentTarget)
    setShowError(true)
    startTransition(() => action(data))
  }

  return (
    <form action={action} onSubmit={submit} className="grid gap-3.5">
      <fieldset className="grid min-w-0 gap-2" disabled={pending}>
        <Label htmlFor="csv">USD transaction CSV</Label>
        <Input
          id="csv"
          name="csv"
          type="file"
          accept=".csv,text/csv"
          required
          disabled={pending}
          aria-invalid={displayedError ? true : undefined}
          aria-describedby={
            displayedError ? "csv-guidance csv-error" : "csv-guidance"
          }
          className={filename ? "text-transparent" : undefined}
          onChange={(event) => {
            setFilename(event.currentTarget.files?.[0]?.name ?? "")
            setShowError(false)
          }}
        />
        {filename && (
          <p className="min-w-0 text-sm font-medium wrap-anywhere">
            {filename}
          </p>
        )}
        <p id="csv-guidance" className="text-sm text-muted-foreground">
          Use a signed amount column or separate debit and credit columns. Buhj
          sends OpenAI column headers and a sample with cell values masked so
          Luna can propose a mapping.
        </p>
      </fieldset>
      {displayedError && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription id="csv-error">{displayedError}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="justify-self-start"
      >
        {pending && (
          <LoaderCircleIcon
            data-icon="inline-start"
            aria-hidden="true"
            className="motion-safe:animate-spin"
          />
        )}
        {pending ? "Preparing preview…" : "Preview import"}
      </Button>
      <span className="sr-only" role="status">
        {pending ? "Uploading CSV and preparing the import preview." : ""}
      </span>
    </form>
  )
}
