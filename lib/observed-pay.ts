import { payScheduleValues } from "./income"

export type ObservedDeposit = {
  importId: string
  sourceRow: number
  postedDate: string
  amountCents: bigint
}

type PaySchedule = (typeof payScheduleValues)[number]

type Cadence =
  | { status: "sparse" | "unclear" }
  | {
      status: "supported"
      paySchedule: PaySchedule
      takeHomePerPaycheckCents: bigint
      latestPayday: string
    }

const dayMs = 86_400_000

function monthIndex(date: Date) {
  return date.getUTCFullYear() * 12 + date.getUTCMonth()
}

function halfMonthIndex(date: Date) {
  return monthIndex(date) * 2 + Number(date.getUTCDate() > 15)
}

export function summarizeObservedPay(deposits: ObservedDeposit[]) {
  const dates = [
    ...new Set(deposits.map(({ postedDate }) => postedDate)),
  ].sort()
  const latestPayday = dates.at(-1)
  const cadence: Cadence =
    dates.length < 3 || !latestPayday
      ? { status: "sparse" }
      : inferCadence(dates, deposits, latestPayday)

  return { deposits, sampleSize: deposits.length, cadence }
}

function inferCadence(
  dates: string[],
  deposits: ObservedDeposit[],
  latestPayday: string
): Cadence {
  if (dates.length !== deposits.length) return { status: "unclear" }

  const posted = dates.map((date) => new Date(date + "T00:00:00Z"))
  const intervals = posted.slice(1).map((date, index) => {
    const previous = posted[index]
    return {
      days: (date.getTime() - previous.getTime()) / dayMs,
      nextMonth: monthIndex(date) - monthIndex(previous) === 1,
      nextHalf: halfMonthIndex(date) - halfMonthIndex(previous) === 1,
    }
  })
  const matches = payScheduleValues.filter((schedule) =>
    intervals.every(({ days, nextMonth, nextHalf }) => {
      switch (schedule) {
        case "weekly":
          return days >= 5 && days <= 9
        case "biweekly":
          return days >= 12 && days <= 16
        case "semimonthly":
          return nextHalf && days >= 11 && days <= 20
        case "monthly":
          return nextMonth && days >= 26 && days <= 34
      }
    })
  )
  const [paySchedule] = matches
  if (!paySchedule || matches.length !== 1) return { status: "unclear" }

  const total = deposits.reduce(
    (sum, deposit) => sum + deposit.amountCents,
    BigInt(0)
  )
  const count = BigInt(deposits.length)
  return {
    status: "supported",
    paySchedule,
    takeHomePerPaycheckCents: (total + count / BigInt(2)) / count,
    latestPayday,
  }
}
