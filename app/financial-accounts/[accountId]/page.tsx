import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { listCsvImports } from "@/lib/csv-import/imports"

import { UploadForm } from "./imports/upload-form"
import { getFinancialAccount } from "../accounts"

export default async function FinancialAccountPage({
  params,
}: PageProps<"/financial-accounts/[accountId]">) {
  const { accountId } = await params
  const account = await getFinancialAccount(accountId)
  const imports = await listCsvImports(account.id)

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
            <h2>Import transactions</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm accountId={account.id} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Import history</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-muted-foreground">No imports yet.</p>
          ) : (
            <ul className="space-y-3">
              {imports.map((entry) => (
                <li key={entry.id} className="wrap-break-word">
                  <Link
                    className="underline underline-offset-4"
                    href={`/financial-accounts/${account.id}/imports/${entry.id}`}
                  >
                    {entry.filename}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {entry.confirmedAt
                      ? `${entry.transactionCount} transactions imported on ${entry.confirmedAt.toISOString().slice(0, 10)} UTC`
                      : "Preview ready"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
