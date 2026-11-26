import Link from "next/link"
import { notFound } from "next/navigation"

import { requireUserId, validUuid } from "@/app/financial-accounts/accounts"
import { formatUsd } from "@/app/spending/model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { payScheduleLabels } from "@/lib/income"
import { baselineLabels, projectionEvidence } from "@/lib/projections/model"
import { getResult } from "@/lib/saved-results"

import { SaveProjectionForm } from "../projection-form"

export default async function ProjectionPage({
  params,
}: PageProps<"/projections/[resultId]">) {
  const userId = await requireUserId()
  const { resultId } = await params
  if (!validUuid(resultId)) notFound()
  const result = await getResult(userId, resultId, "projection")
  if (result?.snapshot.kind !== "projection") notFound()
  const projection = result.snapshot
  const {
    asOf,
    sourcePeriod,
    spending,
    baseline,
    scenario,
    assumptions,
    explanation,
  } = projection

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link
        href="/projections"
        className="text-sm underline underline-offset-4"
      >
        Savings Projections
      </Link>
      <h1 className="text-3xl font-semibold">
        {result.savedAt ? "Saved Projection" : "Savings Projection"}
      </h1>
      <p>
        Source period {sourcePeriod.start} to {sourcePeriod.end}
      </p>
      <Card>
        <CardHeader>
          <CardTitle>
            {scenario.kind === "spending"
              ? "Spending change"
              : "Savings target"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p>
              {baselineLabels[baseline.kind]} ·{" "}
              {formatUsd(BigInt(baseline.paycheckCents))} per paycheck ·{" "}
              {payScheduleLabels[baseline.schedule]}
            </p>
            {baseline.kind === "observed" && (
              <p>
                Based on {baseline.sampleSize} confirmed deposits through{" "}
                {baseline.latestPayday}.
              </p>
            )}
            <p>
              {spending.purchases} recorded{" "}
              {spending.purchases === 1 ? "purchase" : "purchases"}. Activity
              dated {spending.observedRange.start} to{" "}
              {spending.observedRange.end}.
            </p>
            {scenario.kind === "target" && (
              <p>
                Starting amount {formatUsd(BigInt(scenario.startingCents))}.
                Target {formatUsd(BigInt(scenario.targetCents))}
                {scenario.targetDate
                  ? " by " + scenario.targetDate
                  : " with no target date"}
                . Calculated on {asOf} UTC.
              </p>
            )}
          </div>
          <dl className="space-y-3">
            {projectionEvidence(projection).map(({ label, detail }) => (
              <div key={label}>
                <dt className="font-medium">{label}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Advice</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {explanation.map(({ evidence, advice }) => (
              <li key={evidence}>
                <p>{advice}</p>
                <p className="text-sm text-muted-foreground">
                  Based on {evidence}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {!result.savedAt && <SaveProjectionForm id={resultId} />}
    </main>
  )
}
