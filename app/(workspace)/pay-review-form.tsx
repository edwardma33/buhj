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
      className="flex max-w-lg flex-col gap-4 pt-1 pb-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="review-month">Completed month</Label>
        <Input
          id="review-month"
          name="month"
          type="month"
          className="max-w-56"
          max={latestMonth}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expected-dates">Expected paydays</Label>
        <p id="expected-dates-hint" className="text-xs text-muted-foreground">
          Use YYYY-MM-DD, one scheduled payday per line.
        </p>
        <Textarea
          id="expected-dates"
          name="expectedDates"
          maxLength={400}
          value={dates}
          onChange={(event) => setDates(event.target.value)}
          aria-describedby="expected-dates-hint"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Checkbox
            id="pay-coverage"
            name="coverage"
            value="full"
            checked={fullCoverage}
            onCheckedChange={setFullCoverage}
            aria-describedby="pay-coverage-hint"
          />
          <Label htmlFor="pay-coverage" className="leading-snug">
            I imported the full month for every account that receives my regular
            pay.
          </Label>
        </div>
        <p id="pay-coverage-hint" className="text-xs text-muted-foreground">
          Leave unchecked if coverage is partial or uncertain.{" "}
          <Link
            href={
              (month ? "/spending?month=" + month : "/spending") +
              "#transactions"
            }
            className="underline underline-offset-4"
          >
            Mark regular pay in Monthly spending
          </Link>
          .
        </p>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="self-start max-sm:min-h-10"
      >
        {pending ? "Saving…" : "Save month setup"}
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
