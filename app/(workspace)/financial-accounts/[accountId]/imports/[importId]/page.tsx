import { InfoIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getCsvImport,
  listImportTransactions,
  reviewOverlaps,
} from "@/lib/csv-import/imports"

import { getFinancialAccount, validUuid } from "../../../accounts"
import { cancelImport, confirmImport, correctImportRow } from "../actions"

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export default async function ImportPage({
  params,
  searchParams,
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
  const overlaps = preview
    ? await reviewOverlaps(account.id, preview.rows)
    : new Map()
  const { notice, row: invalidRow } = await searchParams
  const possible = [...overlaps.values()].filter(
    (match) => match === "possible"
  ).length
  const corrections = rows.filter((row) => "correction" in row).length
  const accepted = rows.flatMap((row) =>
    "transaction" in row && !overlaps.has(row.row) ? [row.transaction] : []
  )
  let inflows = 0
  let outflows = 0
  for (const { amountCents } of accepted) {
    inflows += Math.max(0, amountCents)
    outflows -= Math.min(0, amountCents)
  }

  return (
    <main className="workspace-page workspace-page-narrow space-y-6">
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
          {entry.confirmedAt && notice === "already-imported" && (
            <Alert role="status">
              <InfoIcon aria-hidden="true" />
              <AlertDescription>
                This CSV was already imported into this account. You’re viewing
                the original import.
              </AlertDescription>
            </Alert>
          )}
          <p className="wrap-break-word">{entry.filename}</p>
          {preview && (
            <section aria-label="Proposed column mapping" className="space-y-2">
              <h2 className="font-semibold">Luna&apos;s proposed mapping</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                <dt>Date</dt>
                <dd>{preview.columns.date}</dd>
                <dt>Description</dt>
                <dd>{preview.columns.description}</dd>
                {"amount" in preview.columns ? (
                  <>
                    <dt>Amount</dt>
                    <dd>{preview.columns.amount}</dd>
                    <dt>Sign convention</dt>
                    <dd>
                      {preview.columns.sign === "positive-inflow"
                        ? "Positive amounts are inflows"
                        : "Positive amounts are outflows"}
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>Debit</dt>
                    <dd>{preview.columns.debit}</dd>
                    <dt>Credit</dt>
                    <dd>{preview.columns.credit}</dd>
                  </>
                )}
              </dl>
            </section>
          )}
          <p>
            {accepted.length} {preview ? "ready to import" : "imported"} ·{" "}
            {rows.length - accepted.length - possible} excluded
            {possible > 0 && ` · ${possible} possible duplicates to review`} ·
            Net total {usd.format((inflows - outflows) / 100)}
          </p>
          <p className="text-sm text-muted-foreground">
            Inflows {usd.format(inflows / 100)} · Outflows{" "}
            {usd.format(outflows / 100)}
          </p>
          {preview &&
            (notice === "review" ||
              notice === "empty" ||
              notice === "changed") && (
              <Alert>
                <AlertDescription>
                  {notice === "review"
                    ? "Choose whether to keep or skip each possible duplicate."
                    : notice === "changed"
                      ? "The preview changed. Review it again before confirming."
                      : "There are no new transactions selected to import."}
                </AlertDescription>
              </Alert>
            )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Row</TableHead>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col" className="text-right">
                  Amount
                </TableHead>
                {preview && <TableHead scope="col">Review</TableHead>}
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
                      {preview && (
                        <TableCell>
                          {overlaps.get(row.row) === "duplicate" &&
                            "Duplicate source ID. Excluded."}
                          {overlaps.get(row.row) === "possible" && (
                            <div className="space-y-2">
                              <p>Matches a transaction in this account.</p>
                              <NativeSelect
                                aria-label={`Possible duplicate on row ${row.row}`}
                                name={`overlap-${row.row}`}
                                form="confirm-import"
                                required
                                defaultValue=""
                              >
                                <NativeSelectOption value="" disabled>
                                  Choose keep or skip
                                </NativeSelectOption>
                                <NativeSelectOption value="keep">
                                  Keep transaction
                                </NativeSelectOption>
                                <NativeSelectOption value="skip">
                                  Skip duplicate
                                </NativeSelectOption>
                              </NativeSelect>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </>
                  ) : "correction" in row && preview ? (
                    <TableCell colSpan={4} className="whitespace-normal">
                      <form
                        className="space-y-2"
                        action={correctImportRow.bind(
                          null,
                          account.id,
                          entry.id,
                          row.row
                        )}
                      >
                        <p>{row.correction.description}</p>
                        {"original" in row.correction.date ? (
                          <div className="space-y-2">
                            <p>
                              Invalid or ambiguous date{" "}
                              {row.correction.date.original || "(blank)"}
                            </p>
                            <Label htmlFor={`date-${row.row}`}>
                              Date for row {row.row}
                            </Label>
                            <Input
                              id={`date-${row.row}`}
                              type="date"
                              name="date"
                              required
                            />
                          </div>
                        ) : (
                          <p>{row.correction.date.value}</p>
                        )}
                        {"original" in row.correction.amount ? (
                          <div className="space-y-2">
                            <p>
                              Invalid or ambiguous amount{" "}
                              {row.correction.amount.original || "(blank)"}
                            </p>
                            <Label htmlFor={`amount-${row.row}`}>
                              Amount for row {row.row} (USD)
                            </Label>
                            <Input
                              id={`amount-${row.row}`}
                              name="amount"
                              placeholder="-12.34"
                              required
                              maxLength={32}
                            />
                            <p>Use a minus sign for money out.</p>
                          </div>
                        ) : (
                          <p>{usd.format(row.correction.amount.cents / 100)}</p>
                        )}
                        {notice === "invalid" &&
                          invalidRow === String(row.row) && (
                            <p role="alert">
                              Enter a valid date and signed USD amount for the
                              fields shown.
                            </p>
                          )}
                        <Button type="submit" size="sm" variant="outline">
                          Save row {row.row}
                        </Button>
                      </form>
                    </TableCell>
                  ) : "issues" in row ? (
                    <TableCell colSpan={4} className="whitespace-normal">
                      Excluded. {row.issues.join(" ")}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {preview && !accepted.length && !possible && !corrections && (
            <p>There are no new transactions to import.</p>
          )}
          {preview && (
            <div className="flex flex-wrap gap-3">
              <form
                id="confirm-import"
                action={confirmImport.bind(
                  null,
                  account.id,
                  entry.id,
                  corrections
                )}
              >
                <Button type="submit" disabled={!accepted.length && !possible}>
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
