import { and, inArray, isNotNull, eq, max } from "drizzle-orm"
import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { csvImport, financialTransaction } from "@/lib/db/schema"

import { CashFlowChart } from "./cash-flow-chart"
import { formatUsd, monthRange, summarizeSpending } from "./spending/model"
import { listConfirmedSpending } from "./spending/records"

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

async function loadSpendingSnapshot(accountIds: string[]) {
  if (accountIds.length === 0) return null

  const [latest] = await db
    .select({ postedDate: max(financialTransaction.postedDate) })
    .from(financialTransaction)
    .innerJoin(csvImport, eq(financialTransaction.importId, csvImport.id))
    .where(
      and(
        inArray(csvImport.accountId, accountIds),
        isNotNull(csvImport.confirmedAt)
      )
    )
  if (!latest?.postedDate) return null

  const month = latest.postedDate.slice(0, 7)
  const { end } = monthRange(month)
  const start = new Date(month + "-01T00:00:00Z")
  start.setUTCMonth(start.getUTCMonth() - 5)
  if (start.getUTCFullYear() < 1) start.setUTCFullYear(1, 0, 1)

  const entries = await listConfirmedSpending(
    accountIds,
    start.toISOString().slice(0, 10),
    end
  )
  const entriesByMonth = new Map<string, typeof entries>()
  for (const entry of entries) {
    const period = entry.postedDate.slice(0, 7)
    const monthlyEntries = entriesByMonth.get(period)
    if (monthlyEntries) monthlyEntries.push(entry)
    else entriesByMonth.set(period, [entry])
  }

  const trend = []
  for (const date = start; date.toISOString().slice(0, 7) <= month;) {
    const period = date.toISOString().slice(0, 7)
    const monthlyEntries = entriesByMonth.get(period)
    trend.push({
      month: period,
      net: monthlyEntries ? summarizeSpending(monthlyEntries).net : null,
    })
    date.setUTCMonth(date.getUTCMonth() + 1)
  }

  return {
    month,
    totals: summarizeSpending(entriesByMonth.get(month) ?? []),
    trend,
  }
}

export async function HomeSpending({
  accounts,
}: {
  accounts: { id: string }[]
}) {
  const snapshot = await loadSpendingSnapshot(accounts.map(({ id }) => id))
  const destination =
    accounts.length === 1
      ? "/financial-accounts/" + accounts[0].id
      : "/financial-accounts"

  return (
    <section aria-labelledby="overview-spending">
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2 id="overview-spending" className="text-lg font-semibold">
                Monthly spending
              </h2>
            </CardTitle>
            {snapshot && (
              <p className="text-sm text-muted-foreground">
                <time dateTime={snapshot.month}>
                  {monthLabel.format(
                    new Date(snapshot.month + "-01T00:00:00Z")
                  )}
                </time>
                {" · All accounts"}
              </p>
            )}
          </div>
          {snapshot && (
            <Link
              href={"/spending?month=" + snapshot.month}
              className="inline-flex min-h-8 items-center gap-1.5 font-medium underline underline-offset-4 hover:text-[var(--accent-emphasis)]"
            >
              View spending
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {snapshot ? (
            <>
              <dl className="grid border-t sm:grid-cols-3 sm:pt-3">
                {[
                  { label: "Inflows", amount: snapshot.totals.inflows },
                  { label: "Outflows", amount: snapshot.totals.outflows },
                  {
                    label: "Net cash flow",
                    amount: snapshot.totals.net,
                    net: true,
                  },
                ].map(({ label, amount, net }) => (
                  <div
                    key={label}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-1 py-2 not-first:border-t sm:grid-cols-1 sm:py-0 sm:not-first:border-t-0 sm:not-first:border-l sm:not-first:pl-3"
                  >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd
                      data-net={net || undefined}
                      className="text-lg leading-tight font-semibold tracking-tight tabular-nums data-net:text-[var(--financial-net)] sm:text-2xl"
                    >
                      {formatUsd(amount)}
                    </dd>
                  </div>
                ))}
              </dl>
              <CashFlowChart points={snapshot.trend} />
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-semibold">No confirmed transactions yet</h3>
                <p className="text-muted-foreground">
                  {accounts.length === 0
                    ? "Add an account to import your first statement."
                    : "Import and confirm a statement to see your spending."}
                </p>
              </div>
              <Link href={destination} className={buttonVariants()}>
                {accounts.length === 0
                  ? "Add an account"
                  : accounts.length === 1
                    ? "Import a statement"
                    : "Choose an account"}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
