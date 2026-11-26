import { formatUsd } from "@/app/spending/model"
import { payScheduleLabels } from "@/lib/income"

type Schedule = keyof typeof payScheduleLabels

export const baselineLabels = {
  reported: "Reported pay",
  observed: "Observed pay",
  revised: "Revised pay",
}

export type PayBaseline = {
  schedule: Schedule
  paycheckCents: string
} & (
  | { kind: "reported" }
  | { kind: "revised"; reviewMonth: string }
  | { kind: "observed"; sampleSize: number; latestPayday: string }
)

export type Scenario =
  | { kind: "spending"; category: string; reductionCents: string }
  | {
      kind: "target"
      startingCents: string
      targetCents: string
      targetDate: string | null
    }

type SpendingEvidence = {
  sourcePeriod: { start: string; end: string }
  observedRange: { start: string; end: string }
  purchases: number
  monthlySpendingCents: string
}

const paychecksPerYear = {
  weekly: BigInt(52),
  biweekly: BigInt(26),
  semimonthly: BigInt(24),
  monthly: BigInt(12),
}
const dayMilliseconds = 86_400_000

export function calculateProjection({
  baseline,
  spending,
  scenario,
  asOf,
}: {
  baseline: PayBaseline
  spending: SpendingEvidence
  scenario: Scenario
  asOf: string
}) {
  const monthlyIncome =
    (BigInt(baseline.paycheckCents) * paychecksPerYear[baseline.schedule] +
      BigInt(6)) /
    BigInt(12)
  const monthlySurplus = monthlyIncome - BigInt(spending.monthlySpendingCents)
  const common = {
    kind: "projection",
    version: 1,
    sourcePeriod: spending.sourcePeriod,
    baseline,
    asOf,
    spending,
    monthlyIncomeCents: monthlyIncome.toString(),
    monthlySurplusCents: monthlySurplus.toString(),
    assumptions: [
      "Monthly pay is an annualized average. Actual paycheck counts can vary by calendar month.",
      "Uses the selected month's recorded purchases and refunds as a monthly estimate. Full-month import coverage is unknown.",
      "Excludes internal transfers and other income. Spending and pay may change.",
    ],
  } as const

  if (scenario.kind === "spending") {
    const reduction = BigInt(scenario.reductionCents)
    return {
      ...common,
      scenario: {
        ...scenario,
        revisedSpendingCents: (
          BigInt(spending.monthlySpendingCents) - reduction
        ).toString(),
        revisedSurplusCents: (monthlySurplus + reduction).toString(),
      },
    }
  }

  const difference =
    BigInt(scenario.targetCents) - BigInt(scenario.startingCents)
  const gap = difference > BigInt(0) ? difference : BigInt(0)
  const days = scenario.targetDate
    ? daysBetween(asOf, scenario.targetDate)
    : null
  return {
    ...common,
    scenario: {
      ...scenario,
      gapCents: gap.toString(),
      days,
      weeklyRateCents: days
        ? (
            (gap * BigInt(7) + BigInt(days) - BigInt(1)) /
            BigInt(days)
          ).toString()
        : null,
    },
  }
}

export function daysBetween(start: string, end: string) {
  return (Date.parse(end) - Date.parse(start)) / dayMilliseconds
}

type Projection = ReturnType<typeof calculateProjection>
export type ProjectionSnapshot = Projection & {
  explanation: { evidence: string; advice: string }[]
}

export function projectionEvidence(projection: Projection) {
  const usd = (cents: string) => formatUsd(BigInt(cents))
  const { baseline, scenario, spending } = projection
  const common = [
    {
      label: baselineLabels[baseline.kind],
      detail: `${usd(projection.monthlyIncomeCents)} average per month`,
    },
    {
      label: "Recorded monthly spending",
      detail: `${usd(spending.monthlySpendingCents)} net spending. Full-month coverage is unknown.`,
    },
    {
      label: "Estimated monthly surplus",
      detail: usd(projection.monthlySurplusCents),
    },
  ]
  if (scenario.kind === "spending") {
    return [
      ...common,
      {
        label: `${scenario.category} reduction`,
        detail: `${usd(scenario.reductionCents)} less per month leaves ${usd(scenario.revisedSpendingCents)} in monthly spending and ${usd(scenario.revisedSurplusCents)} in estimated monthly surplus.`,
      },
    ]
  }
  return [
    ...common,
    { label: "Savings gap", detail: usd(scenario.gapCents) },
    ...(scenario.weeklyRateCents === null
      ? []
      : [
          {
            label: "Required weekly savings",
            detail: `${usd(scenario.weeklyRateCents)} per week over ${scenario.days} days, rounded up to the cent.`,
          },
        ]),
  ]
}
