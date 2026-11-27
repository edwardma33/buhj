"use client"

import { BookmarkIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { generateInsight, saveInsight } from "./actions"

export function InsightForm({ month }: { month: string }) {
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [feedback, action, pending] = useActionState(generateInsight, null)
  const [showFeedback, setShowFeedback] = useState(true)

  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={() => setShowFeedback(true)}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex w-full max-w-56 flex-col gap-1.5 sm:w-48">
          <Label htmlFor="insight-month">Month</Label>
          <Input
            id="insight-month"
            name="month"
            type="month"
            value={selectedMonth}
            readOnly={pending}
            onChange={(event) => {
              setSelectedMonth(event.target.value)
              setShowFeedback(false)
            }}
            aria-invalid={
              showFeedback && !pending && feedback?.kind === "invalid-month"
            }
            className="min-h-11 sm:min-h-8"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="min-h-11 sm:min-h-8"
        >
          {pending && (
            <LoaderCircleIcon
              aria-hidden="true"
              data-icon="inline-start"
              className="motion-safe:animate-spin"
            />
          )}
          Generate Insight
        </Button>
      </div>
      <p
        role="status"
        className={pending ? "text-sm text-muted-foreground" : "sr-only"}
      >
        {pending ? "Generating Insight…" : ""}
      </p>
      {showFeedback && !pending && feedback && (
        <Alert
          variant={
            feedback.kind === "provider" || feedback.kind === "invalid-month"
              ? "destructive"
              : "default"
          }
        >
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      )}
      <p className="max-w-prose text-sm text-muted-foreground">
        Buhj sends OpenAI category totals and purchase counts for this month.
        Transaction descriptions, account details, and individual dates stay in
        Buhj.
      </p>
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="min-h-11 sm:min-h-8">
      {pending ? (
        <LoaderCircleIcon
          aria-hidden="true"
          data-icon="inline-start"
          className="motion-safe:animate-spin"
        />
      ) : (
        <BookmarkIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {pending ? "Saving Insight…" : "Save Insight"}
    </Button>
  )
}

export function SaveInsightForm({ id }: { id: string }) {
  return (
    <form action={saveInsight}>
      <input type="hidden" name="id" value={id} />
      <SaveButton />
    </form>
  )
}
