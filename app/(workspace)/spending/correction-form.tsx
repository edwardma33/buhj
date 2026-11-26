"use client"

import { PencilIcon } from "lucide-react"
import { useActionState, useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { correctTransaction } from "./actions"
import {
  categories,
  requiresDeposit,
  spendingKinds,
  spendingKindValues,
  type SpendingKind,
} from "./model"

type Correction = {
  importId: string
  sourceRow: number
  category: (typeof categories)[number]
  kind: SpendingKind
  credit: boolean
}

export function TransactionEditor({
  description,
  posted,
  accountName,
  amount,
  ...correction
}: Correction & {
  description: string
  posted: string
  accountName: string
  amount: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 text-muted-foreground"
          />
        }
        aria-label={`Edit ${description}, ${posted}, ${accountName}, ${amount}`}
      >
        <PencilIcon aria-hidden="true" /> Edit
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto">
        <SheetHeader className="gap-1 border-b border-border pr-12">
          <SheetTitle>Edit transaction</SheetTitle>
          <SheetDescription className="wrap-anywhere">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-4">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Posted</dt>
            <dd>{posted}</dd>
            <dt className="text-muted-foreground">Account</dt>
            <dd className="wrap-anywhere">{accountName}</dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="tabular-nums">{amount}</dd>
          </dl>
          <CorrectionForm {...correction} onSaved={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CorrectionForm({
  importId,
  sourceRow,
  category,
  kind,
  credit,
  onSaved,
}: Correction & { onSaved: () => void }) {
  const [draftCategory, setDraftCategory] = useState<string>(category)
  const [draftKind, setDraftKind] = useState<string>(kind)
  const [error, action, pending] = useActionState(
    async (previous: string, data: FormData) => {
      const error = await correctTransaction(previous, data)
      if (!error) onSaved()
      return error
    },
    ""
  )
  const id = useId()

  return (
    <form action={action} className="grid gap-4 border-t border-border pt-4">
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="sourceRow" value={sourceRow} />
      <div className="grid gap-1.5">
        <Label htmlFor={id + "-category"}>Category</Label>
        <NativeSelect
          id={id + "-category"}
          name="category"
          value={draftCategory}
          onChange={(event) => setDraftCategory(event.target.value)}
        >
          {categories.map((option) => (
            <NativeSelectOption key={option}>{option}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id + "-kind"}>Type</Label>
        <NativeSelect
          id={id + "-kind"}
          name="kind"
          value={draftKind}
          onChange={(event) => setDraftKind(event.target.value)}
        >
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
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}
