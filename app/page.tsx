import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { formatUsd } from "@/app/spending/model"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listPayDifferences } from "@/lib/pay-review/records"
import { auth } from "@/lib/auth/auth"
import { keepForecast } from "./pay-review-actions"
import { PayReviewForm } from "./pay-review-form"
import { SignOutButton } from "./sign-out-button"

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const differences = await listPayDifferences(session.user.id)
  const today = new Date()
  const latestMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)
  )
    .toISOString()
    .slice(0, 7)

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">Buhj</h1>
      <p>Signed in as {session.user.email}</p>
      <p>
        <Link href="/income" className="underline underline-offset-4">
          Income profile
        </Link>
      </p>
      <p>
        <Link
          href="/financial-accounts"
          className="underline underline-offset-4"
        >
          Financial accounts
        </Link>
      </p>
      <p>
        <Link href="/spending" className="underline underline-offset-4">
          Monthly spending
        </Link>
      </p>
      <p>
        <Link href="/insights" className="underline underline-offset-4">
          Spending Insights
        </Link>
      </p>
      <p>
        <Link href="/projections" className="underline underline-offset-4">
          Savings Projections
        </Link>
      </p>
      {differences.map(({ month, expectedCents, confirmedCents, evidence }) => (
        <Card key={month}>
          <CardHeader>
            <CardTitle>Pay difference for {month}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Expected pay</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatUsd(expectedCents)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Confirmed pay</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {formatUsd(confirmedCents)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projections?month=${month}&payReview=${month}`}
                className={buttonVariants()}
              >
                Review forecast
              </Link>
              <form action={keepForecast.bind(null, month, evidence)}>
                <Button type="submit" variant="outline">
                  Keep forecast
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
      <details className="space-y-4 rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">
          Set up a completed-month pay comparison
        </summary>
        <PayReviewForm latestMonth={latestMonth} />
      </details>
      <SignOutButton />
    </main>
  )
}
