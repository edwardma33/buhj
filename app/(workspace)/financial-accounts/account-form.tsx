"use client"

import { PlusIcon, WalletCardsIcon } from "lucide-react"
import { useActionState, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { createFinancialAccount } from "./actions"
import {
  accountFieldMaxLength,
  institutions,
  otherInstitution,
} from "./institutions"

export function AccountCreation({ hasAccounts }: { hasAccounts: boolean }) {
  const [form, setForm] = useState<"initial" | "open" | "closed">("initial")
  const opener = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (form === "closed") opener.current?.focus()
  }, [form])

  const addButton = (
    <Button
      ref={opener}
      type="button"
      size="lg"
      onClick={() => setForm("open")}
    >
      <PlusIcon aria-hidden="true" data-icon="inline-start" />
      Add account
    </Button>
  )

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1>Financial accounts</h1>
        {hasAccounts && form !== "open" && addButton}
      </header>
      {form === "open" ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              <h2>Add an account</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountForm onCancel={() => setForm("closed")} />
          </CardContent>
        </Card>
      ) : (
        !hasAccounts && (
          <Card>
            <CardContent className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <WalletCardsIcon aria-hidden="true" size={18} />
              </span>
              <div className="grid justify-items-start gap-3">
                <div className="grid gap-1">
                  <CardTitle>
                    <h2>No financial accounts yet</h2>
                  </CardTitle>
                  <CardDescription>
                    Add an account to start importing its statements.
                  </CardDescription>
                </div>
                {addButton}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </>
  )
}

function AccountForm({ onCancel }: { onCancel: () => void }) {
  const [error, formAction, pending] = useActionState(
    createFinancialAccount,
    null
  )
  const [dismissedError, setDismissedError] = useState<typeof error>(null)
  const [name, setName] = useState("")
  const [institution, setInstitution] = useState("")
  const [institutionName, setInstitutionName] = useState("")
  const nameInput = useRef<HTMLInputElement>(null)
  const institutionSelect = useRef<HTMLSelectElement>(null)
  const institutionNameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInput.current?.focus()
  }, [])

  useEffect(() => {
    switch (error?.field) {
      case "name":
        nameInput.current?.focus()
        break
      case "institution":
        institutionSelect.current?.focus()
        break
      case "institutionName":
        institutionNameInput.current?.focus()
        break
    }
  }, [error])

  const visibleError = pending || error === dismissedError ? null : error
  const nameError =
    visibleError?.field === "name" ? visibleError.message : undefined
  const institutionError =
    visibleError?.field === "institution" ? visibleError.message : undefined
  const institutionNameError =
    visibleError?.field === "institutionName" ? visibleError.message : undefined

  // Keep the native select value when the action returns a validation error.
  return (
    <form action={formAction} onReset={(event) => event.preventDefault()}>
      <fieldset disabled={pending} className="grid min-w-0 gap-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor="financial-account-name">Account name</Label>
          <Input
            ref={nameInput}
            id="financial-account-name"
            name="name"
            className="max-sm:h-10"
            maxLength={accountFieldMaxLength}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (nameError) setDismissedError(error)
            }}
            aria-invalid={!!nameError}
            aria-describedby={
              nameError ? "financial-account-name-error" : undefined
            }
            required
          />
          {nameError && (
            <p id="financial-account-name-error" className="text-destructive">
              {nameError}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="financial-institution">Institution</Label>
          <NativeSelect
            ref={institutionSelect}
            id="financial-institution"
            name="institution"
            className="w-full max-sm:[&>select]:h-10"
            value={institution}
            onChange={(event) => {
              setInstitution(event.target.value)
              if (institutionError) setDismissedError(error)
            }}
            aria-invalid={!!institutionError}
            aria-describedby={
              institutionError ? "financial-institution-error" : undefined
            }
            required
          >
            <NativeSelectOption value="" disabled>
              Select an institution
            </NativeSelectOption>
            {institutions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value={otherInstitution}>
              Other institution
            </NativeSelectOption>
          </NativeSelect>
          {institutionError && (
            <p id="financial-institution-error" className="text-destructive">
              {institutionError}
            </p>
          )}
        </div>
        {institution === otherInstitution && (
          <div className="grid gap-1.5">
            <Label htmlFor="financial-institution-name">Institution name</Label>
            <Input
              ref={institutionNameInput}
              id="financial-institution-name"
              name="institutionName"
              className="max-sm:h-10"
              maxLength={accountFieldMaxLength}
              value={institutionName}
              onChange={(event) => {
                setInstitutionName(event.target.value)
                if (institutionNameError) setDismissedError(error)
              }}
              aria-invalid={!!institutionNameError}
              aria-describedby={
                institutionNameError
                  ? "financial-institution-name-error"
                  : undefined
              }
              required
            />
            {institutionNameError && (
              <p
                id="financial-institution-name-error"
                className="text-destructive"
              >
                {institutionNameError}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </fieldset>
      <span className="sr-only" role="status">
        {pending && "Creating account…"}
      </span>
    </form>
  )
}
