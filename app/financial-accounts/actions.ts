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

export async function createFinancialAccount(
  _previousError: string,
  formData: FormData
) {
  const userId = await requireUserId()
  const name = readName(formData.get("name"))
  if (!name)
    return `Enter an account name of 1 to ${accountFieldMaxLength} characters.`

  const selection = formData.get("institution")
  const institution =
    selection === otherInstitution
      ? readName(formData.get("institutionName"))
      : institutions.find((option) => option === selection)
  if (!institution) {
    return selection === otherInstitution
      ? `Enter an institution name of 1 to ${accountFieldMaxLength} characters.`
      : "Select an institution."
  }

  const [account] = await db
    .insert(financialAccount)
    .values({ name, institution, userId })
    .returning({ id: financialAccount.id })
  revalidatePath("/financial-accounts")
  redirect(`/financial-accounts/${account.id}`)
}
