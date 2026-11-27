"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { incomeProfile } from "@/lib/db/schema"
import { jobTitleMaxLength, payScheduleValues } from "@/lib/income"

import type { IncomeFormState } from "./income-form"

function readText(formData: FormData, field: string) {
  const value = formData.get(field)
  return typeof value === "string" ? value.trim() : ""
}

function parseCents(amount: string) {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount)) return null

  const [dollars, cents = ""] = amount.split(".")
  const total = Number(dollars) * 100 + Number(cents.padEnd(2, "0"))
  return total > 0 ? total : null
}

export async function saveIncome(
  _state: IncomeFormState,
  formData: FormData
): Promise<IncomeFormState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const jobTitle = readText(formData, "jobTitle")
  const grossAnnualCents = parseCents(readText(formData, "grossAnnual"))
  const takeHomePerPaycheckCents = parseCents(readText(formData, "takeHome"))
  const scheduleInput = readText(formData, "paySchedule")
  const paySchedule = payScheduleValues.find((value) => value === scheduleInput)

  const errors: NonNullable<IncomeFormState["errors"]> = {}
  const amountError =
    "Enter a positive amount with up to 12 digits before the decimal and 2 after it. Leave out commas and the dollar sign."
  const validTitle =
    jobTitle.length > 0 &&
    jobTitle.length <= jobTitleMaxLength &&
    !jobTitle.includes("\0")

  if (!validTitle) errors.jobTitle = "Enter a job title of 1 to 120 characters."
  if (grossAnnualCents === null) errors.grossAnnual = amountError
  if (takeHomePerPaycheckCents === null) errors.takeHome = amountError
  if (!paySchedule) errors.paySchedule = "Choose a pay schedule."

  if (
    !validTitle ||
    grossAnnualCents === null ||
    takeHomePerPaycheckCents === null ||
    !paySchedule
  ) {
    return { errors }
  }

  const profile = {
    jobTitle,
    grossAnnualCents,
    takeHomePerPaycheckCents,
    paySchedule,
  }
  try {
    await db
      .insert(incomeProfile)
      .values({ ...profile, userId: session.user.id })
      .onConflictDoUpdate({ target: incomeProfile.userId, set: profile })
  } catch {
    return { saveFailed: true }
  }

  revalidatePath("/income")
  return { saved: true }
}
