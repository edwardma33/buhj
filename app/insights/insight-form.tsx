"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { generateInsight, saveInsight } from "./actions"

export function InsightForm({ month }: { month: string }) {
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [error, action, pending] = useActionState(generateInsight, "")
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            name="month"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate Insight"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save Insight"}
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
