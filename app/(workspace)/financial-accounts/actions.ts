"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { financialAccount } from "@/lib/db/schema"

import { requireUserId } from "./accounts"
import {
  accountFieldMaxLength,
  institutions,
  otherInstitution,
} from "./institutions"

function readName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null
  const name = value.trim()
  return name && name.length <= accountFieldMaxLength && !name.includes("\0")
    ? name
    : null
}

type AccountValidationError = {
  field: "name" | "institution" | "institutionName"
  message: string
}

export async function createFinancialAccount(
  _previousError: AccountValidationError | null,
  formData: FormData
): Promise<AccountValidationError> {
  const userId = await requireUserId()
  const name = readName(formData.get("name"))
  if (!name) {
    return {
      field: "name",
      message: `Enter an account name of 1 to ${accountFieldMaxLength} characters.`,
    }
  }

  const selection = formData.get("institution")
  const institution =
    selection === otherInstitution
      ? readName(formData.get("institutionName"))
      : institutions.find((option) => option === selection)
  if (!institution) {
    return selection === otherInstitution
      ? {
          field: "institutionName",
          message: `Enter an institution name of 1 to ${accountFieldMaxLength} characters.`,
        }
      : { field: "institution", message: "Select an institution." }
  }

  const [account] = await db
    .insert(financialAccount)
    .values({ name, institution, userId })
    .returning({ id: financialAccount.id })
  revalidatePath("/financial-accounts")
  redirect(`/financial-accounts/${account.id}`)
}
