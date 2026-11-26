import Link from "next/link"

import { requireUserId } from "@/app/financial-accounts/accounts"
import { monthRange } from "@/app/spending/model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        <CardContent>
          <ProjectionForm
            key={month}
            month={month}
            observedAvailable={observed !== null}
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
                      {baselineKind === "observed"
                        ? "Observed pay"
                        : "Reported pay"}{" "}
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
