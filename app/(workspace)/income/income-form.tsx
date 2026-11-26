"use client"

import { useActionState, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  jobTitleMaxLength,
  payScheduleLabels,
  payScheduleValues,
} from "@/lib/income"

import { saveIncome } from "./actions"

const textFields = [
  {
    name: "jobTitle",
    label: "Job title",
    autoComplete: "organization-title",
    maxLength: jobTitleMaxLength,
  },
  {
    name: "grossAnnual",
    label: "Gross annual earnings (USD)",
    inputMode: "decimal",
    placeholder: "85000.00",
  },
  {
    name: "takeHome",
    label: "Take-home pay per paycheck (USD)",
    inputMode: "decimal",
    placeholder: "2400.00",
  },
] as const

type IncomeFields = Record<
  (typeof textFields)[number]["name"] | "paySchedule",
  string
>

export type IncomeFormState = {
  errors?: Partial<IncomeFields>
  saved?: boolean
  saveFailed?: boolean
}

export function IncomeForm({ initialValues }: { initialValues: IncomeFields }) {
  const [values, setValues] = useState(initialValues)
  const [state, action, pending] = useActionState(saveIncome, {})
  const [edited, setEdited] = useState(false)

  function changeField(name: keyof IncomeFields, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setEdited(true)
  }

  return (
    <form action={action} onSubmit={() => setEdited(false)}>
      <fieldset disabled={pending} className="space-y-4">
        {textFields.map(({ name, label, ...props }) => (
          <div key={name} className="grid gap-1.5">
            <Label htmlFor={name}>{label}</Label>
            <Input
              {...props}
              id={name}
              name={name}
              value={values[name]}
              onChange={(event) => changeField(name, event.target.value)}
              aria-invalid={Boolean(state.errors?.[name])}
              aria-describedby={
                state.errors?.[name] ? `${name}-error` : undefined
              }
              required
            />
            {state.errors?.[name] && (
              <p id={`${name}-error`} className="text-sm text-destructive">
                {state.errors[name]}
              </p>
            )}
          </div>
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="paySchedule">Pay schedule</Label>
          <NativeSelect
            id="paySchedule"
            name="paySchedule"
            value={values.paySchedule}
            onChange={(event) => changeField("paySchedule", event.target.value)}
            aria-invalid={Boolean(state.errors?.paySchedule)}
            aria-describedby={
              state.errors?.paySchedule ? "paySchedule-error" : undefined
            }
            required
          >
            <NativeSelectOption value="" disabled>
              Select a pay schedule
            </NativeSelectOption>
            {payScheduleValues.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {payScheduleLabels[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {state.errors?.paySchedule && (
            <p id="paySchedule-error" className="text-sm text-destructive">
              {state.errors.paySchedule}
            </p>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save income profile"}
        </Button>
      </fieldset>
      {!pending && state.errors && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Check the highlighted fields and try again.
          </AlertDescription>
        </Alert>
      )}
      {!pending && state.saveFailed && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Could not save your income profile. Try again.
          </AlertDescription>
        </Alert>
      )}
      {!pending && state.saved && !edited && (
        <Alert role="status" className="mt-4">
          <AlertDescription>Income profile saved.</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
