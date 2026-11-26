import { createHash } from "node:crypto"

import { monthRange } from "@/app/spending/model"
import type { ObservedDeposit } from "@/lib/observed-pay"
import type { PayBaseline } from "@/lib/projections/model"

export function completedMonth(value: unknown) {
  const range = monthRange(value)
  const currentMonth = new Date().toISOString().slice(0, 7)
  return range.month === value && range.month < currentMonth ? range : null
}

export function readExpectedDates(month: string, input: unknown) {
  if (typeof input !== "string" || input.length > 400) return null
  const { start, end } = monthRange(month)
  const dates = input
    .trim()
    .split(/[\s,]+/)
    .sort()
  if (
    dates.length !== new Set(dates).size ||
    dates.some(
      (date) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end
    )
  )
    return null
  return dates
}

export function comparePay({
  month,
  expectedDates,
  baseline,
  deposits,
}: {
  month: string
  expectedDates: string[]
  baseline: Extract<PayBaseline, { kind: "reported" }>
  deposits: ObservedDeposit[]
}) {
  const confirmed = deposits.filter(({ postedDate }) =>
    postedDate.startsWith(month + "-")
  )
  const expectedCents =
    BigInt(baseline.paycheckCents) * BigInt(expectedDates.length)
  const confirmedCents = confirmed.reduce(
    (total, { amountCents }) => total + amountCents,
    BigInt(0)
  )
  const evidence = createHash("sha256")
    .update(
      JSON.stringify([
        month,
        baseline.schedule,
        baseline.paycheckCents,
        expectedDates,
        confirmed.map(({ importId, sourceRow, postedDate, amountCents }) => [
          importId,
          sourceRow,
          postedDate,
          amountCents.toString(),
        ]),
      ])
    )
    .digest("hex")
  return { month, expectedCents, confirmedCents, evidence }
}
