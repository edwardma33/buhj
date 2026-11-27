"use client"

import { cn } from "cn"
import { PencilIcon } from "lucide-react"
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

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

type TextField = {
  name: "jobTitle" | "grossAnnual" | "takeHome"
  label: string
  hint?: string
  autoComplete?: string
  maxLength?: number
  inputMode?: "decimal"
}

const textFields: TextField[] = [
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
    hint: "What you earn in a year before taxes and deductions.",
  },
  {
    name: "takeHome",
    label: "Take-home pay per paycheck (USD)",
    inputMode: "decimal",
    hint: "What you receive in one paycheck after taxes and deductions.",
  },
]

type IncomeFields = Record<
  (typeof textFields)[number]["name"] | "paySchedule",
  string
>

export type IncomeFormState = {
  errors?: Partial<IncomeFields>
  saved?: boolean
  saveFailed?: boolean
}

export function IncomeEditor({
  initialValues,
  isNew,
}: {
  initialValues: IncomeFields
  isNew: boolean
}) {
  const [editing, setEditing] = useState(isNew)
  const [saved, setSaved] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)

  const restoreFocus = useRef(false)

  const closeEditor = useCallback(() => {
    restoreFocus.current = true
    setEditing(false)
  }, [])

  const saveComplete = useCallback(() => {
    setSaved(true)
    closeEditor()
  }, [closeEditor])

  useEffect(() => {
    if (!editing && !isNew && restoreFocus.current) {
      editButton.current?.focus()
      restoreFocus.current = false
    }
  }, [editing, isNew])

  return (
    <>
      {!isNew && (
        <Button
          ref={editButton}
          type="button"
          variant="outline"
          className="self-start"
          disabled={editing}
          aria-expanded={editing}
          aria-controls="reported-pay-editor"
          onClick={() => {
            setSaved(false)
            setEditing(true)
          }}
        >
          <PencilIcon data-icon="inline-start" />
          Edit reported pay
        </Button>
      )}
      <div id="reported-pay-editor" hidden={!editing}>
        {editing && (
          <IncomeForm
            initialValues={initialValues}
            isNew={isNew}
            onCancel={closeEditor}
            onSaved={saveComplete}
          />
        )}
      </div>
      <div role="status" className={saved ? undefined : "sr-only"}>
        {saved && "Income profile saved."}
      </div>
    </>
  )
}

function IncomeForm({
  initialValues,
  isNew,
  onCancel,
  onSaved,
}: {
  initialValues: IncomeFields
  isNew: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(saveIncome, {})

  useEffect(() => {
    if (!isNew && !state.saved) form.current?.querySelector("input")?.focus()
  }, [isNew, state.saved])

  useEffect(() => {
    if (state.saved) onSaved()
  }, [state.saved, onSaved])

  useEffect(() => {
    if (!pending && state.errors) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [pending, state.errors])

  return (
    <form
      ref={form}
      action={action}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return

        // Bypass React's form reset so rejected submissions preserve the selected schedule.
        const formData = new FormData(event.currentTarget)
        startTransition(() => action(formData))
      }}
    >
      <fieldset
        disabled={pending}
        className="@container flex min-w-0 flex-col gap-4"
      >
        <div className="grid gap-4 @lg:grid-cols-2">
          {textFields.map(({ name, label, hint, ...props }) => {
            const error = state.errors?.[name]
            const description = [
              hint && `${name}-hint`,
              error && `${name}-error`,
            ]
              .filter(Boolean)
              .join(" ")

            return (
              <div
                key={name}
                className={cn(
                  "flex flex-col gap-1.5",
                  name === "jobTitle" && "@lg:col-span-2"
                )}
              >
                <Label htmlFor={name}>{label}</Label>
                <Input
                  {...props}
                  id={name}
                  name={name}
                  defaultValue={initialValues[name]}
                  aria-invalid={Boolean(error)}
                  aria-describedby={description || undefined}
                  required
                />
                {hint && (
                  <p id={`${name}-hint`} className="text-muted-foreground">
                    {hint}
                  </p>
                )}
                {error && (
                  <p id={`${name}-error`} className="text-destructive">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
          <div className="flex flex-col gap-1.5 @lg:col-start-2">
            <Label htmlFor="paySchedule">Pay schedule</Label>
            <NativeSelect
              id="paySchedule"
              name="paySchedule"
              className="w-full"
              defaultValue={initialValues.paySchedule}
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
              <p id="paySchedule-error" className="text-destructive">
                {state.errors.paySchedule}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : isNew
                ? "Save income profile"
                : "Save changes"}
          </Button>
          {!isNew && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
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
    </form>
  )
}
