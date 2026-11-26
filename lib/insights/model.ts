import { spendingCategory, summarizeSpending } from "@/app/(workspace)/spending/model"

type Category = ReturnType<typeof spendingCategory>
type SpendingEntry = Parameters<typeof summarizeSpending>[0][number] & {
  postedDate: string
}
type Period = { start: string; end: string }
type CategoryEvidence = {
  category: Category
  netCents: string
  purchases: number
  purchaseDays: number
}

export const insightAssumptions = [
  "Includes confirmed transactions across your financial accounts. Import coverage for the full month is unknown.",
  "Internal transfers are excluded. Refunds count as inflows and reduce category spending.",
  "Suggestions require purchases on at least two dates in a category with positive net spending.",
]

export function summarizeInsight(period: Period, entries: SpendingEntry[]) {
  const activity = entries.filter(({ kind }) => kind !== "transfer")
  const { inflows, outflows, net, categoryTotals } = summarizeSpending(activity)
  const purchases = new Map<Category, string[]>()
  let firstDate = ""
  let lastDate = ""

  for (const entry of activity) {
    if (!firstDate || entry.postedDate < firstDate) firstDate = entry.postedDate
    if (entry.postedDate > lastDate) lastDate = entry.postedDate
    if (entry.kind === "activity" && entry.amountCents < BigInt(0)) {
      const dates = purchases.get(entry.category) ?? []
      dates.push(entry.postedDate)
      purchases.set(entry.category, dates)
    }
  }

  const categories: CategoryEvidence[] = Array.from(
    categoryTotals,
    ([category, cents]) => {
      const dates = purchases.get(category) ?? []
      return {
        category,
        netCents: cents.toString(),
        purchases: dates.length,
        purchaseDays: new Set(dates).size,
      }
    }
  ).sort((a, b) => a.category.localeCompare(b.category))

  return {
    sourcePeriod: period,
    inputs: {
      transactionCount: activity.length,
      observedRange: activity.length
        ? { start: firstDate, end: lastDate }
        : null,
    },
    values: {
      inflowCents: inflows.toString(),
      outflowCents: outflows.toString(),
      netCents: net.toString(),
      categories,
    },
  }
}

export function supportsSuggestion(evidence: CategoryEvidence) {
  return evidence.purchaseDays >= 2 && BigInt(evidence.netCents) > BigInt(0)
}

export type InsightSnapshot = ReturnType<typeof summarizeInsight> & {
  kind: "insight"
  version: 1
  assumptions: string[]
  explanation: { category: Category; advice: string }[]
}
