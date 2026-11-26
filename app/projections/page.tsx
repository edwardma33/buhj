import Link from "next/link"

import { requireUserId } from "@/app/financial-accounts/accounts"
import { formatUsd, monthRange } from "@/app/spending/model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { payScheduleLabels } from "@/lib/income"
import { listPayDifferences } from "@/lib/pay-review/records"
import { baselineLabels } from "@/lib/projections/model"
import { getProjectionPay } from "@/lib/projections/pay"
import { listSavedResults } from "@/lib/saved-results"

import { ProjectionForm } from "./projection-form"

export default async function ProjectionsPage({
  searchParams,
}: PageProps<"/projections">) {
  const userId = await requireUserId()
  const [query, observed, saved] = await Promise.all([
    searchParams,
    getProjectionPay(userId, "observed"),
    listSavedResults(userId, "projection"),
  ])
  const { month } = monthRange(query.month)
  const [review] =
    typeof query.payReview === "string"
      ? await listPayDifferences(userId, query.payReview)
      : []

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link href="/" className="text-sm underline underline-offset-4">
        Home
      </Link>
      <h1 className="text-3xl font-semibold">Savings Projections</h1>
      <p className="text-sm text-muted-foreground">
        Buhj sends OpenAI the calculated amounts, selected category for spending
        changes, and time remaining for dated targets. Individual transactions
        and income profile details stay in Buhj.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>New Projection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {review && (
            <div className="space-y-1 text-sm">
              <p>Pay review for {review.month}</p>
              <p>
                Expected {formatUsd(review.expectedCents)}. Confirmed{" "}
                {formatUsd(review.confirmedCents)}.
              </p>
              {observed && (
                <p>
                  Observed pay is {formatUsd(BigInt(observed.paycheckCents))}{" "}
                  per paycheck. {payScheduleLabels[observed.schedule]}.
                </p>
              )}
            </div>
          )}
          <ProjectionForm
            key={review?.evidence ?? month}
            month={month}
            observedAvailable={observed !== null}
            review={
              review && {
                month: review.month,
                evidence: review.evidence,
                schedule: review.schedule,
              }
            }
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Saved Projections</CardTitle>
        </CardHeader>
        <CardContent>
          {saved.length === 0 ? (
            <p>No saved Projections yet.</p>
          ) : (
            <ul className="space-y-2">
              {saved.map(
                ({ id, sourcePeriod, savedAt, scenarioKind, baselineKind }) => (
                  <li key={id}>
                    <Link
                      href={"/projections/" + id}
                      className="underline underline-offset-4"
                    >
                      {scenarioKind === "target"
                        ? "Savings target"
                        : "Spending change"}{" "}
                      ·{" "}
                      {baselineKind === "observed" || baselineKind === "revised"
                        ? baselineLabels[baselineKind]
                        : baselineLabels.reported}{" "}
                      · {sourcePeriod.start} to {sourcePeriod.end}
                    </Link>
                    {savedAt && (
                      <p className="text-sm text-muted-foreground">
                        Saved{" "}
                        {savedAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
                        UTC
                      </p>
                    )}
                  </li>
                )
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
