import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { listPayDifferences } from "@/lib/pay-review/records"
import { getProjectionPay } from "@/lib/projections/pay"

import {
  listFinancialAccounts,
  requireUserId,
} from "./financial-accounts/accounts"
import { HomeSpending } from "./home-spending"
import { PayReview } from "./pay-review"

export default async function Page() {
  const userId = await requireUserId()
  const [accounts, reportedPay, differences] = await Promise.all([
    listFinancialAccounts(),
    getProjectionPay(userId, "reported"),
    listPayDifferences(userId),
  ])

  const previousMonth = new Date()
  previousMonth.setUTCDate(1)
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1)
  const latestMonth = previousMonth.toISOString().slice(0, 7)

  return (
    <main className="workspace-page workspace-page-narrow flex flex-col gap-6">
      <h1>Overview</h1>
      <HomeSpending accounts={accounts} />
      {!reportedPay && (
        <section aria-labelledby="overview-income">
          <h2 id="overview-income" className="text-lg font-semibold">
            Income
          </h2>
          <Link
            href="/income"
            className="group flex items-center justify-between gap-3 border-b py-3 text-sm"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold group-hover:underline group-hover:underline-offset-4">
                Set up income
              </span>
              <span className="text-muted-foreground">
                Enter your take-home pay and schedule.
              </span>
            </span>
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </Link>
        </section>
      )}
      {(accounts.length > 0 || reportedPay) && (
        <PayReview
          latestMonth={latestMonth}
          differences={differences.map(
            ({ month, expectedCents, confirmedCents, evidence }) => ({
              month,
              expectedCents,
              confirmedCents,
              evidence,
            })
          )}
        />
      )}
    </main>
  )
}
