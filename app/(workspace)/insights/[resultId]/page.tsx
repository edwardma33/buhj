import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  requireUserId,
  validUuid,
} from "@/app/(workspace)/financial-accounts/accounts"
import { formatUsd } from "@/app/(workspace)/spending/model"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getResult } from "@/lib/saved-results"

import { formatSavedAt, formatSourceMonth, formatSourcePeriod } from "../dates"
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
  const sourceMonth = sourcePeriod.start.slice(0, 7)
  const adviceByCategory = new Map(
    explanation.map(({ category, advice }) => [category, advice])
  )
  const suggested = values.categories.filter(({ category }) =>
    adviceByCategory.has(category)
  )
  const other = values.categories.filter(
    ({ category }) => !adviceByCategory.has(category)
  )

  return (
    <main className="workspace-page workspace-page-narrow flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <Link
          href={`/insights?month=${sourceMonth}`}
          className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground sm:min-h-8"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Spending Insights
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1>{formatSourceMonth(sourcePeriod.start)} Insight</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {formatSourcePeriod(sourcePeriod)}
            </p>
            <p
              role="status"
              className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
            >
              {result.savedAt ? (
                <>
                  <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="font-medium">Saved</span>
                  <time
                    dateTime={result.savedAt.toISOString()}
                    className="text-muted-foreground"
                  >
                    {formatSavedAt(result.savedAt)}
                  </time>
                </>
              ) : (
                <>
                  <FileTextIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span className="font-medium">Draft</span>
                  <span className="text-muted-foreground">
                    Save within 24 hours to keep it.
                  </span>
                </>
              )}
            </p>
          </div>
          {!result.savedAt && <SaveInsightForm id={resultId} />}
        </div>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Spending evidence</h2>
          {inputs.observedRange && (
            <p className="text-sm text-muted-foreground">
              {inputs.transactionCount} confirmed transactions across all
              accounts, excluding transfers. Activity recorded{" "}
              {formatSourcePeriod(inputs.observedRange)}.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-3">
            {[
              { label: "Inflows", cents: values.inflowCents },
              { label: "Outflows", cents: values.outflowCents },
              { label: "Net cash flow", cents: values.netCents },
            ].map(({ label, cents }) => (
              <div
                key={label}
                className="flex min-w-0 items-baseline justify-between gap-x-4 sm:flex-col sm:gap-y-0.5"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="min-w-0 text-right text-base font-semibold tabular-nums sm:text-left">
                  {formatUsd(BigInt(cents))}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <section
        aria-labelledby="insight-suggestions"
        className="flex flex-col gap-2"
      >
        <h2 id="insight-suggestions" className="text-base font-semibold">
          Suggestions
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {suggested.map((entry) => (
            <li
              key={entry.category}
              className="grid gap-x-5 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
            >
              <div>
                <h3 className="text-sm font-semibold">{entry.category}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {formatUsd(BigInt(entry.netCents))}
                  </span>{" "}
                  net spending
                </p>
                <p className="text-sm text-muted-foreground">
                  {purchaseCoverage(entry)}
                </p>
              </div>
              <p className="text-sm leading-relaxed">
                {adviceByCategory.get(entry.category)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {other.length > 0 && (
        <section
          aria-labelledby="other-category-evidence"
          className="flex flex-col gap-2"
        >
          <h2 id="other-category-evidence" className="text-base font-semibold">
            Other category evidence
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {other.map((entry) => (
              <li
                key={entry.category}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-x-4 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <span className="font-medium">{entry.category}</span>
                <span className="row-start-2 text-muted-foreground sm:row-start-auto">
                  {purchaseCoverage(entry)}
                </span>
                <span className="col-start-2 row-span-2 row-start-1 text-right tabular-nums sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                  {formatUsd(BigInt(entry.netCents))}
                  <span className="sr-only"> net spending</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group border-t text-sm">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-sm font-medium [&::-webkit-details-marker]:hidden">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 group-open:rotate-180"
          />
          How this Insight was calculated
        </summary>
        <ul className="flex max-w-prose list-disc flex-col gap-1 pl-5 text-muted-foreground">
          {assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
    </main>
  )
}

function purchaseCoverage({
  purchases,
  purchaseDays,
}: {
  purchases: number
  purchaseDays: number
}) {
  return `${purchases} ${purchases === 1 ? "purchase" : "purchases"} on ${purchaseDays} ${purchaseDays === 1 ? "date" : "dates"}`
}
