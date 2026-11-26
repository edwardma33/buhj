"use client"

import { useActionState, useId } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { correctTransaction } from "./actions"
import {
  categories,
  requiresDeposit,
  spendingKinds,
  spendingKindValues,
  type SpendingKind,
} from "./model"

export function CorrectionForm({
  importId,
  sourceRow,
  category,
  kind,
  credit,
}: {
  importId: string
  sourceRow: number
  category: (typeof categories)[number]
  kind: SpendingKind
  credit: boolean
}) {
  const [error, action, pending] = useActionState(correctTransaction, "")
  const id = useId()

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="sourceRow" value={sourceRow} />
      <div className="grid gap-1.5">
        <Label htmlFor={id + "-category"}>Category</Label>
        <NativeSelect
          id={id + "-category"}
          name="category"
          defaultValue={category}
        >
          {categories.map((option) => (
            <NativeSelectOption key={option}>{option}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id + "-kind"}>Type</Label>
        <NativeSelect id={id + "-kind"} name="kind" defaultValue={kind}>
          {spendingKindValues.map((value) => (
            <NativeSelectOption
              key={value}
              value={value}
              disabled={requiresDeposit(value) && !credit}
            >
              {spendingKinds[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {error && (
        <p role="alert" className="basis-full text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
