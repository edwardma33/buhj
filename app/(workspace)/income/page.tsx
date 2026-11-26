import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatUsd } from "@/app/(workspace)/spending/model"
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

import { IncomeForm } from "./income-form"

export default async function IncomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const [profile, observed] = await Promise.all([
    db.query.incomeProfile.findFirst({
      where: eq(incomeProfile.userId, session.user.id),
    }),
    getObservedPay(session.user.id),
  ])
  const { cadence } = observed

  return (
    <main className="workspace-page workspace-page-narrow space-y-4">
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
      <h1 className="text-xl font-semibold">Income profile</h1>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Card aria-label="Reported pay">
          <CardHeader>
            <CardTitle>Reported pay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile ? (
              <>
                <p>
                  {formatUsd(BigInt(profile.takeHomePerPaycheckCents))} per
                  paycheck
                </p>
                <p>{payScheduleLabels[profile.paySchedule]}</p>
              </>
            ) : (
              <p>Enter your take-home pay and schedule below.</p>
            )}
          </CardContent>
        </Card>
        <Card aria-label="Observed pay">
          <CardHeader>
            <CardTitle>Observed pay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              {observed.sampleSize} confirmed{" "}
              {observed.sampleSize === 1 ? "deposit" : "deposits"}
            </p>
            {cadence.status === "supported" && (
              <>
                <p>
                  {formatUsd(cadence.takeHomePerPaycheckCents)} per paycheck on
                  average
                </p>
                <p>{payScheduleLabels[cadence.paySchedule]}</p>
              </>
            )}
            {cadence.status === "sparse" && (
              <p>
                Confirm regular pay on at least three different dates to compare
                schedules.
              </p>
            )}
            {cadence.status === "unclear" && (
              <p>These deposit dates do not establish a single pay schedule.</p>
            )}
            {observed.sampleSize > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posted date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {observed.deposits.map((deposit) => (
                    <TableRow key={deposit.importId + ":" + deposit.sourceRow}>
                      <TableCell>{deposit.postedDate}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatUsd(deposit.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Link
              href="/spending#transactions"
              className="text-sm underline underline-offset-4"
            >
              Classify deposits in Monthly spending
            </Link>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edit reported pay</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeForm
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
    </main>
  )
}
