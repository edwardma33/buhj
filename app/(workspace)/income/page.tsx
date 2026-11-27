import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

import { formatUsd } from "@/app/(workspace)/spending/model"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { incomeProfile } from "@/lib/db/schema"
import { payScheduleLabels } from "@/lib/income"
import { getObservedPay } from "@/lib/observed-pay-records"

import { IncomeEditor } from "./income-form"

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export default async function IncomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const [profile, observed] = await Promise.all([
    db.query.incomeProfile.findFirst({
      where: eq(incomeProfile.userId, session.user.id),
    }),
    getObservedPay(session.user.id),
  ])
  const { cadence, deposits, sampleSize } = observed

  return (
    <main className="workspace-page workspace-page-narrow flex flex-col gap-6">
      <h1>{profile ? "Income" : "Set up income"}</h1>
      <div
        className={
          profile ? "grid items-start gap-4 sm:grid-cols-2" : "grid gap-4"
        }
      >
        <Card role="region" aria-labelledby="reported-pay">
          <CardHeader>
            <CardTitle id="reported-pay" role="heading" aria-level={2}>
              Reported pay
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            {profile && (
              <>
                <div>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatUsd(BigInt(profile.takeHomePerPaycheckCents))}
                  </p>
                  <p className="text-muted-foreground">
                    Take-home pay per paycheck
                  </p>
                  <p className="mt-2 font-medium">
                    {payScheduleLabels[profile.paySchedule]}
                  </p>
                </div>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t pt-3">
                  <dt className="text-muted-foreground">
                    Gross annual earnings
                  </dt>
                  <dd className="text-right tabular-nums">
                    {formatUsd(BigInt(profile.grossAnnualCents))}
                  </dd>
                  <dt className="text-muted-foreground">Job title</dt>
                  <dd className="max-w-[20ch] text-right">
                    {profile.jobTitle}
                  </dd>
                </dl>
              </>
            )}
            <IncomeEditor
              isNew={!profile}
              initialValues={{
                jobTitle: profile?.jobTitle ?? "",
                grossAnnual: profile
                  ? (profile.grossAnnualCents / 100).toFixed(2)
                  : "",
                takeHome: profile
                  ? (profile.takeHomePerPaycheckCents / 100).toFixed(2)
                  : "",
                paySchedule: profile?.paySchedule ?? "",
              }}
            />
          </CardContent>
        </Card>
        <Card role="region" aria-labelledby="observed-pay">
          <CardHeader>
            <CardTitle id="observed-pay" role="heading" aria-level={2}>
              Observed pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cadence.status === "supported" ? (
              <>
                <p className="text-xl font-semibold tabular-nums">
                  {formatUsd(cadence.takeHomePerPaycheckCents)}
                </p>
                <p className="text-muted-foreground">
                  Average take-home pay per paycheck
                </p>
                <p className="mt-2 font-medium">
                  {payScheduleLabels[cadence.paySchedule]}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  {cadence.status === "unclear"
                    ? "Unclear pay schedule"
                    : "Not enough deposit dates"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {cadence.status === "unclear"
                    ? "These deposits don’t establish a single pay schedule."
                    : "A schedule needs regular deposits on at least three distinct dates."}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <section className="min-w-0" aria-labelledby="regular-deposits">
        <Card>
          <CardHeader>
            <CardTitle id="regular-deposits" role="heading" aria-level={2}>
              Regular deposits
            </CardTitle>
            <CardDescription>
              Observed pay uses confirmed transactions marked{" "}
              <strong className="font-medium">Regular pay</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            {sampleSize > 0 ? (
              <div className="w-full">
                <Table
                  aria-label={`${sampleSize} confirmed regular ${sampleSize === 1 ? "deposit" : "deposits"}`}
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posted date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((deposit) => (
                      <TableRow
                        key={deposit.importId + ":" + deposit.sourceRow}
                      >
                        <TableCell>
                          <time dateTime={deposit.postedDate}>
                            {dateFormat.format(
                              new Date(deposit.postedDate + "T00:00:00Z")
                            )}
                          </time>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatUsd(deposit.amountCents)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No confirmed regular deposits yet.
              </p>
            )}
            <Link
              href="/spending#transactions"
              className="underline underline-offset-4"
            >
              Classify deposits in Monthly spending
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
