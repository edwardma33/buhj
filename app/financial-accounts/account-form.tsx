"use client"

import { useActionState, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { createFinancialAccount } from "./actions"
import {
  accountFieldMaxLength,
  institutions,
  otherInstitution,
} from "./institutions"

export function AccountForm() {
  const [error, formAction, pending] = useActionState(
    createFinancialAccount,
    ""
  )
  const [name, setName] = useState("")
  const [institution, setInstitution] = useState("")
  const [institutionName, setInstitutionName] = useState("")

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="financial-account-name">Account name</Label>
        <Input
          id="financial-account-name"
          name="name"
          maxLength={accountFieldMaxLength}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="financial-institution">Institution</Label>
        <NativeSelect
          id="financial-institution"
          name="institution"
          className="w-full"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
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
      </div>
      {institution === otherInstitution && (
        <div className="grid gap-1.5">
          <Label htmlFor="financial-institution-name">Institution name</Label>
          <Input
            id="financial-institution-name"
            name="institutionName"
            maxLength={accountFieldMaxLength}
            value={institutionName}
            onChange={(event) => setInstitutionName(event.target.value)}
            required
          />
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
