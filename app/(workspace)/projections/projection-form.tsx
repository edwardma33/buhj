"use client"

import { useActionState, useState, type ComponentProps } from "react"
import { useFormStatus } from "react-dom"

import { categories } from "@/app/(workspace)/spending/model"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { payScheduleLabels } from "@/lib/income"

import { generateProjection, saveProjection } from "./actions"

function Field({
  label,
  initial = "",
  ...props
}: ComponentProps<typeof Input> & { label: string; initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input
        {...props}
        id={props.name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  )
}

export function ProjectionForm({
  month,
  observedAvailable,
  review,
}: {
  month: string
  observedAvailable: boolean
  review?: {
    month: string
    evidence: string
    schedule: keyof typeof payScheduleLabels
  }
}) {
  const [scenario, setScenario] = useState("spending")
  const [baseline, setBaseline] = useState(
    review ? (observedAvailable ? "observed" : "revised") : "reported"
  )
  const [category, setCategory] = useState("")
  const [error, action, pending] = useActionState(generateProjection, "")

  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="space-y-4"
    >
      {review && (
        <>
          <input type="hidden" name="reviewMonth" value={review.month} />
          <input type="hidden" name="reviewEvidence" value={review.evidence} />
        </>
      )}
      <Field
        label="Source month"
        name="month"
        type="month"
        initial={month}
        required
      />
      <div className="grid gap-1.5">
        <Label htmlFor="baseline">Pay baseline</Label>
        <NativeSelect
          id="baseline"
          name="baseline"
          value={baseline}
          onChange={(event) => setBaseline(event.target.value)}
        >
          <NativeSelectOption value="reported">Reported pay</NativeSelectOption>
          <NativeSelectOption value="observed" disabled={!observedAvailable}>
            Observed pay
          </NativeSelectOption>
          {review && (
            <NativeSelectOption value="revised">Revised pay</NativeSelectOption>
          )}
        </NativeSelect>
        {!observedAvailable && (
          <p className="text-sm text-muted-foreground">
            Confirm regular deposits in Monthly spending to establish an
            Observed pay schedule.
          </p>
        )}
      </div>
      {baseline === "revised" && review && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Take-home pay per paycheck (USD)"
            name="revisedPay"
            inputMode="decimal"
            required
          />
          <div className="grid gap-1.5">
            <Label htmlFor="revisedSchedule">Pay schedule</Label>
            <NativeSelect
              id="revisedSchedule"
              name="revisedSchedule"
              defaultValue={review.schedule}
            >
              {Object.entries(payScheduleLabels).map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="scenario">Scenario</Label>
        <NativeSelect
          id="scenario"
          name="scenario"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          <NativeSelectOption value="spending">
            Spending change
          </NativeSelectOption>
          <NativeSelectOption value="target">Savings target</NativeSelectOption>
        </NativeSelect>
      </div>
      {scenario === "spending" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="category">Spending category</Label>
            <NativeSelect
              id="category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            >
              <NativeSelectOption value="" disabled>
                Choose a category
              </NativeSelectOption>
              {categories.map((name) => (
                <NativeSelectOption key={name}>{name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Field
            label="Monthly reduction (USD)"
            name="reduction"
            inputMode="decimal"
            required
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            key="starting"
            label="Starting amount (USD)"
            name="starting"
            inputMode="decimal"
            initial="0"
            required
          />
          <Field
            label="Savings target (USD)"
            name="target"
            inputMode="decimal"
            required
          />
          <Field label="Target date (optional)" name="targetDate" type="date" />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate Projection"}
      </Button>
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
      {pending ? "Saving…" : "Save Projection"}
    </Button>
  )
}

export function SaveProjectionForm({ id }: { id: string }) {
  return (
    <form action={saveProjection}>
      <input type="hidden" name="id" value={id} />
      <SaveButton />
    </form>
  )
}
