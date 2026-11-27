"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireUserId } from "@/app/(workspace)/financial-accounts/accounts"
import { db } from "@/lib/db"
import { payReviewDismissal, payReviewMonth } from "@/lib/db/schema"
import { completedMonth, readExpectedDates } from "@/lib/pay-review/model"
import { listPayDifferences } from "@/lib/pay-review/records"
import { getProjectionPay } from "@/lib/projections/pay"

type MonthSetupStatus = { kind: "error"; message: string } | { kind: "saved" }

export async function recordPayReviewMonth(
  _previous: MonthSetupStatus | null,
  form: FormData
): Promise<MonthSetupStatus> {
  const userId = await requireUserId()
  const range = completedMonth(form.get("month"))
  if (!range) return { kind: "error", message: "Choose a completed month." }

  if (form.get("coverage") === "full") {
    const expectedDates = readExpectedDates(
      range.month,
      form.get("expectedDates")
    )
    if (!expectedDates)
      return {
        kind: "error",
        message:
          "Enter each expected payday in that month once, using YYYY-MM-DD.",
      }
    const baseline = await getProjectionPay(userId, "reported")
    if (!baseline)
      return {
        kind: "error",
        message: "Add your Reported pay in Income first.",
      }

    const evidence = {
      expectedDates,
      schedule: baseline.schedule,
      fullCoverage: true,
    }
    await db
      .insert(payReviewMonth)
      .values({ userId, monthStart: range.start, ...evidence })
      .onConflictDoUpdate({
        target: [payReviewMonth.userId, payReviewMonth.monthStart],
        set: evidence,
      })
  } else {
    await db
      .update(payReviewMonth)
      .set({ fullCoverage: false })
      .where(
        and(
          eq(payReviewMonth.userId, userId),
          eq(payReviewMonth.monthStart, range.start)
        )
      )
  }

  revalidatePath("/")
  return { kind: "saved" }
}

type KeepForecastStatus = { kind: "stale" } | { kind: "kept"; month: string }

export async function keepForecast(
  _previous: KeepForecastStatus | null,
  form: FormData
): Promise<KeepForecastStatus> {
  const userId = await requireUserId()
  const range = completedMonth(form.get("month"))
  const evidence = form.get("evidence")
  if (!range || typeof evidence !== "string") return { kind: "stale" }

  const [current] = await listPayDifferences(userId, range.month)
  if (current?.evidence !== evidence) {
    revalidatePath("/")
    return { kind: "stale" }
  }

  await db
    .insert(payReviewDismissal)
    .values({ userId, monthStart: range.start, evidence })
    .onConflictDoNothing()
  revalidatePath("/")
  return { kind: "kept", month: range.month }
}
