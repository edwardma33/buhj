import Link from "next/link"

import { requireUserId } from "@/app/financial-accounts/accounts"
import { monthRange } from "@/app/spending/model"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listSavedResults } from "@/lib/saved-results"

import { InsightForm } from "./insight-form"

const savedDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

export default async function InsightsPage({
  searchParams,
}: PageProps<"/insights">) {
  const userId = await requireUserId()
  const [query, saved] = await Promise.all([
    searchParams,
    listSavedResults(userId, "insight"),
  ])

  const { month } = monthRange(query.month)

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link href="/" className="text-sm underline underline-offset-4">
        Home
      </Link>
      <h1 className="text-3xl font-semibold">Spending Insights</h1>
      <p className="text-sm text-muted-foreground">
        Buhj sends OpenAI category totals and purchase counts for your selected
        month. Transaction descriptions, account details, and individual dates
        stay in Buhj.
      </p>
      <InsightForm key={month} month={month} />
      <Card>
        <CardHeader>
          <CardTitle>Saved Insights</CardTitle>
        </CardHeader>
        <CardContent>
          {saved.length === 0 ? (
            <p>No saved Insights yet.</p>
          ) : (
            <ul className="space-y-2">
              {saved.map(({ id, sourcePeriod, savedAt }) => (
                <li key={id}>
                  <Link
                    href={"/insights/" + id}
                    className="underline underline-offset-4"
                  >
                    {sourcePeriod.start} to {sourcePeriod.end}
                  </Link>
                  {savedAt && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      Saved {savedDate.format(savedAt)} UTC
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
