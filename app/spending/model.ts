export const categories = [
  "Uncategorized",
  "Groceries",
  "Dining",
  "Housing",
  "Utilities",
  "Transportation",
  "Health",
  "Shopping",
  "Entertainment",
  "Travel",
  "Other",
] as const

type Category = (typeof categories)[number]

export function spendingCategory(value: unknown): Category {
  return categories.find((category) => category === value) ?? "Uncategorized"
}

export function monthRange(value: unknown) {
  const month =
    typeof value === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
      ? value
      : new Date().toISOString().slice(0, 7)
  const start = month + "-01"
  const lastDay = new Date(start + "T00:00:00Z")
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0)
  const end = month + "-" + lastDay.getUTCDate()
  return { month, start, end }
}

export const spendingKinds = {
  activity: "Activity",
  refund: "Refund",
  transfer: "Internal transfer",
} as const

export type SpendingKind = keyof typeof spendingKinds

export function spendingKind(value: unknown): SpendingKind | undefined {
  if (value === "activity" || value === "refund" || value === "transfer")
    return value
}

type SpendingEntry = {
  amountCents: bigint
  category: Category
  kind: SpendingKind
}

export function summarizeSpending(entries: SpendingEntry[]) {
  let inflows = BigInt(0)
  let outflows = BigInt(0)
  const categoryTotals = new Map<Category, bigint>()

  for (const entry of entries) {
    if (entry.kind === "transfer") continue
    if (entry.amountCents > BigInt(0)) inflows += entry.amountCents
    if (entry.amountCents < BigInt(0)) outflows -= entry.amountCents
    if (isCategorySpending(entry)) {
      const previous = categoryTotals.get(entry.category) ?? BigInt(0)
      categoryTotals.set(entry.category, previous - entry.amountCents)
    }
  }

  return { inflows, outflows, net: inflows - outflows, categoryTotals }
}

export function isCategorySpending(entry: SpendingEntry) {
  return (
    entry.kind === "refund" ||
    (entry.kind === "activity" && entry.amountCents < BigInt(0))
  )
}

const wholeDollars = new Intl.NumberFormat("en-US")

export function formatUsd(cents: bigint) {
  const absolute = cents < BigInt(0) ? -cents : cents
  const dollars = wholeDollars.format(absolute / BigInt(100))
  const fraction = String(absolute % BigInt(100)).padStart(2, "0")
  return (cents < BigInt(0) ? "-$" : "$") + dollars + "." + fraction
}
