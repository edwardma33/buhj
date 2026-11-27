import { BookmarkIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import { requireUserId } from "@/app/(workspace)/financial-accounts/accounts"
import { monthRange } from "@/app/(workspace)/spending/model"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { listSavedResults } from "@/lib/saved-results"

import { formatSavedAt, formatSourceMonth } from "./dates"
import { InsightForm } from "./insight-form"

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
    <main className="workspace-page workspace-page-narrow flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1>Spending Insights</h1>
        <p className="text-sm text-muted-foreground">
          Get suggestions based on a month of confirmed spending.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Generate an Insight</h2>
        </CardHeader>
        <CardContent>
          <InsightForm key={month} month={month} />
        </CardContent>
      </Card>

      <section aria-labelledby="saved-insights" className="flex flex-col gap-2">
        <h2 id="saved-insights" className="text-base font-semibold">
          Saved Insights
        </h2>
        {saved.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border px-4 py-4 text-sm">
            <BookmarkIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div>
              <p className="font-medium">No saved Insights yet</p>
              <p className="mt-0.5 text-muted-foreground">
                Save a draft to keep its spending evidence and suggestions here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {saved.map(({ id, sourcePeriod, savedAt }) => (
              <li key={id}>
                <Link
                  href={`/insights/${id}`}
                  className="relative flex min-h-12 items-center gap-3 rounded-lg px-4 py-2.5 text-sm hover:bg-muted focus-visible:z-1"
                >
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="font-medium">
                      {formatSourceMonth(sourcePeriod.start)}
                    </span>
                    {savedAt && (
                      <span className="text-muted-foreground">
                        Saved{" "}
                        <time dateTime={savedAt.toISOString()}>
                          {formatSavedAt(savedAt)}
                        </time>
                      </span>
                    )}
                  </div>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
