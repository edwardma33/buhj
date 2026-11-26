import Link from "next/link"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getCsvImport, listImportTransactions } from "@/lib/csv-import/imports"

import { getFinancialAccount, validUuid } from "../../../accounts"
import { cancelImport, confirmImport } from "../actions"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default async function ImportPage({
  params,
}: PageProps<"/financial-accounts/[accountId]/imports/[importId]">) {
  const { accountId, importId } = await params
  const account = await getFinancialAccount(accountId)
  if (!validUuid(importId)) notFound()
  const entry = await getCsvImport(account.id, importId)
  const preview = entry?.preview
  const accountPath = `/financial-accounts/${account.id}`
  const rows =
    preview?.rows ??
    (entry?.confirmedAt
      ? (await listImportTransactions(entry.id)).map((transaction) => ({
          row: transaction.sourceRow,
          transaction,
        }))
      : [])
  const accepted = rows.flatMap((row) =>
    "transaction" in row ? [row.transaction] : []
  )
  let inflows = 0
  let outflows = 0
  for (const { amountCents } of accepted) {
    inflows += Math.max(0, amountCents)
    outflows -= Math.min(0, amountCents)
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <Link href={accountPath} className="text-sm underline underline-offset-4">
        Back to {account.name}
      </Link>
      <h1 className="text-3xl font-semibold">
        {preview
          ? "Import preview"
          : entry
            ? "Confirmed import"
            : "Import unavailable"}
      </h1>
      {!entry ? (
        <p>
          This import is unavailable for this account. Return to the account to
          upload a CSV.
        </p>
      ) : (
        <>
          <p className="wrap-break-word">{entry.filename}</p>
          {preview && (
            <section aria-label="Proposed column mapping" className="space-y-2">
              <h2 className="font-semibold">Luna&apos;s proposed mapping</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                <dt>Date</dt>
                <dd>{preview.columns.date}</dd>
                <dt>Description</dt>
                <dd>{preview.columns.description}</dd>
                <dt>Amount</dt>
                <dd>{preview.columns.amount}</dd>
                <dt>Sign convention</dt>
                <dd>
                  {preview.columns.sign === "positive-inflow"
                    ? "Positive amounts are inflows"
                    : "Positive amounts are outflows"}
                </dd>
              </dl>
            </section>
          )}
          <p>
            {accepted.length} {preview ? "ready to import" : "imported"} ·{" "}
            {rows.length - accepted.length} excluded · Net total{" "}
            {usd.format((inflows - outflows) / 100)}
          </p>
          <p className="text-sm text-muted-foreground">
            Inflows {usd.format(inflows / 100)} · Outflows{" "}
            {usd.format(outflows / 100)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Row</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col" className="text-right">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.row}>
                  <TableCell>{row.row}</TableCell>
                  {"transaction" in row ? (
                    <>
                      <TableCell>{row.transaction.postedDate}</TableCell>
                      <TableCell className="wrap-anywhere whitespace-normal">
                        {row.transaction.description}
                      </TableCell>
                      <TableCell className="text-right">
                        {usd.format(row.transaction.amountCents / 100)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} className="whitespace-normal">
                      Excluded. {row.issues.join(" ")}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview && (
            <div className="flex flex-wrap gap-3">
              <form action={confirmImport.bind(null, account.id, entry.id)}>
                <Button type="submit" disabled={!accepted.length}>
                  Confirm import
                </Button>
              </form>
              <form action={cancelImport.bind(null, account.id, entry.id)}>
                <Button type="submit" variant="outline">
                  Cancel import
                </Button>
              </form>
            </div>
          )}
        </>
      )}
    </main>
  )
}
