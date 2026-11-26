import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { AccountForm } from "./account-form"
import { listFinancialAccounts } from "./accounts"

export default async function FinancialAccountsPage() {
  const accounts = await listFinancialAccounts()

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to Buhj
      </Link>
      <h1 className="text-3xl font-semibold">Financial accounts</h1>
      {accounts.length === 0 ? (
        <p className="text-muted-foreground">
          You haven’t added any financial accounts yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id} className="min-w-0">
              <Card>
                <CardContent className="space-y-1 wrap-break-word">
                  <Link
                    href={`/financial-accounts/${account.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {account.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {account.institution}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Add a financial account</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountForm />
        </CardContent>
      </Card>
    </main>
  )
}
