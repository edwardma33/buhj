"use client"

import Link from "next/link"
import { useActionState, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { recordPayReviewMonth } from "./pay-review-actions"

export function PayReviewForm({ latestMonth }: { latestMonth: string }) {
  const [status, action, pending] = useActionState(recordPayReviewMonth, null)
  const [month, setMonth] = useState(latestMonth)
  const [fullCoverage, setFullCoverage] = useState(false)
  const [dates, setDates] = useState("")

  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="space-y-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="review-month">Completed month</Label>
        <Input
          id="review-month"
          name="month"
          type="month"
          max={latestMonth}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          required
        />
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="pay-coverage"
          name="coverage"
          value="full"
          checked={fullCoverage}
          onCheckedChange={setFullCoverage}
        />
        <Label htmlFor="pay-coverage">
          I imported the full month for every account that receives my regular
          pay.
        </Label>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expected-dates">Expected paydays</Label>
        <Textarea
          id="expected-dates"
          name="expectedDates"
          maxLength={400}
          value={dates}
          onChange={(event) => setDates(event.target.value)}
          aria-describedby="expected-dates-hint"
        />
        <p id="expected-dates-hint" className="text-sm text-muted-foreground">
          Mark regular deposits in{" "}
          <Link
            href="/spending#transactions"
            className="underline underline-offset-4"
          >
            Monthly spending
          </Link>
          . Enter each date from your pay schedule as YYYY-MM-DD, one per line.
          Leave coverage unchecked to mark the month partial or unknown.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        Save month setup
      </Button>
      {status?.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
      {status?.kind === "saved" && <p role="status">Month setup saved.</p>}
    </form>
  )
}
