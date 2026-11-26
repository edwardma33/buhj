import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getFinancialAccount } from "../accounts"

export default async function FinancialAccountPage({
  params,
}: PageProps<"/financial-accounts/[accountId]">) {
  const { accountId } = await params
  const account = await getFinancialAccount(accountId)

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <Link
        href="/financial-accounts"
        className="text-sm underline underline-offset-4"
      >
        Back to financial accounts
      </Link>
      <header className="space-y-1 wrap-break-word">
        <h1 className="text-3xl font-semibold">{account.name}</h1>
        <p className="text-muted-foreground">{account.institution}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Import history</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No imports yet. Confirmed CSV imports for this account will appear
            here.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
