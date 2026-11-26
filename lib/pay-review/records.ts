import "server-only"

import { and, desc, eq, lt } from "drizzle-orm"

import { db } from "@/lib/db"
import { payReviewDismissal, payReviewMonth } from "@/lib/db/schema"
import { getObservedPay } from "@/lib/observed-pay-records"
import { getProjectionPay } from "@/lib/projections/pay"

import { comparePay, completedMonth } from "./model"

export async function listPayDifferences(userId: string, month?: string) {
  const range = month === undefined ? null : completedMonth(month)
  if (month !== undefined && !range) return []

  const setups = await db
    .select()
    .from(payReviewMonth)
    .where(
      and(
        eq(payReviewMonth.userId, userId),
        eq(payReviewMonth.fullCoverage, true),
        range
          ? eq(payReviewMonth.monthStart, range.start)
          : lt(
              payReviewMonth.monthStart,
              new Date().toISOString().slice(0, 7) + "-01"
            )
      )
    )
    .orderBy(desc(payReviewMonth.monthStart))
  if (setups.length === 0) return []

  const [baseline, { deposits }, dismissals] = await Promise.all([
    getProjectionPay(userId, "reported"),
    getObservedPay(userId),
    db
      .select({ evidence: payReviewDismissal.evidence })
      .from(payReviewDismissal)
      .where(
        and(
          eq(payReviewDismissal.userId, userId),
          range ? eq(payReviewDismissal.monthStart, range.start) : undefined
        )
      ),
  ])
  if (!baseline) return []

  const dismissed = new Set(dismissals.map(({ evidence }) => evidence))
  return setups
    .filter(({ schedule }) => schedule === baseline.schedule)
    .map(({ monthStart, expectedDates }) =>
      comparePay({
        month: monthStart.slice(0, 7),
        expectedDates,
        baseline,
        deposits,
      })
    )
    .filter(
      (review) =>
        review.expectedCents !== review.confirmedCents &&
        !dismissed.has(review.evidence)
    )
    .map((review) => ({ ...review, schedule: baseline.schedule }))
}
