import Link from "next/link"
import { notFound } from "next/navigation"

import { requireUserId, validUuid } from "@/app/financial-accounts/accounts"
import { formatUsd } from "@/app/spending/model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getResult } from "@/lib/saved-results"

import { SaveInsightForm } from "../insight-form"

export default async function InsightPage({
  params,
}: PageProps<"/insights/[resultId]">) {
  const userId = await requireUserId()
  const { resultId } = await params
  if (!validUuid(resultId)) notFound()
  const result = await getResult(userId, resultId, "insight")
  if (result?.snapshot.kind !== "insight") notFound()

  const { sourcePeriod, inputs, values, assumptions, explanation } =
    result.snapshot
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link href="/insights" className="text-sm underline underline-offset-4">
        Spending Insights
      </Link>
      <h1 className="text-3xl font-semibold">
        {result.savedAt ? "Saved Insight" : "Spending Insight"}
      </h1>
      <p>
        Source period {sourcePeriod.start} to {sourcePeriod.end}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Spending evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inputs.observedRange && (
            <p>
              {inputs.transactionCount} confirmed transactions from{" "}
              {inputs.observedRange.start} to {inputs.observedRange.end},
              excluding transfers.
            </p>
          )}
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt>Inflows</dt>
              <dd>{formatUsd(BigInt(values.inflowCents))}</dd>
            </div>
            <div>
              <dt>Outflows</dt>
              <dd>{formatUsd(BigInt(values.outflowCents))}</dd>
            </div>
            <div>
              <dt>Net cash flow</dt>
              <dd>{formatUsd(BigInt(values.netCents))}</dd>
            </div>
          </dl>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {values.categories.map((entry) => {
        const suggestion = explanation.find(
          ({ category }) => category === entry.category
        )
        return (
          <Card key={entry.category}>
            <CardHeader>
              <CardTitle>{entry.category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                {formatUsd(BigInt(entry.netCents))} net spending.{" "}
                {entry.purchases}{" "}
                {entry.purchases === 1 ? "purchase" : "purchases"} on{" "}
                {entry.purchaseDays}{" "}
                {entry.purchaseDays === 1 ? "date" : "dates"}.
              </p>
              {suggestion && <p>{suggestion.advice}</p>}
            </CardContent>
          </Card>
        )
      })}
      {!result.savedAt && <SaveInsightForm id={resultId} />}
    </main>
  )
}
