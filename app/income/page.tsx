import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { incomeProfile } from "@/lib/db/schema"

import { IncomeForm } from "./income-form"

export default async function IncomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const profile = await db.query.incomeProfile.findFirst({
    where: eq(incomeProfile.userId, session.user.id),
  })

  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Income profile</h1>
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
