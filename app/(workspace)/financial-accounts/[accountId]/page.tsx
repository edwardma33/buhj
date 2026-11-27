import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  LandmarkIcon,
} from "lucide-react"
import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listCsvImports } from "@/lib/csv-import/imports"

import { getFinancialAccount } from "../accounts"
import { UploadForm } from "./imports/upload-form"

const confirmationDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export default async function FinancialAccountPage({
  params,
}: PageProps<"/financial-accounts/[accountId]">) {
  const { accountId } = await params
  const account = await getFinancialAccount(accountId)
  const imports = await listCsvImports(account.id)

  return (
    <main className="workspace-page workspace-page-narrow grid gap-6">
      <header className="grid gap-3.5">
        <Link
          href="/financial-accounts"
          className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon aria-hidden="true" size={16} />
          Back to financial accounts
        </Link>
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <LandmarkIcon aria-hidden="true" size={20} />
          </span>
          <div className="grid min-w-0 gap-0.5 wrap-anywhere">
            <h1>{account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {account.institution}
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="csv-upload-heading">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="csv-upload-heading">Upload a CSV</h2>
            </CardTitle>
            <CardDescription>
              You’ll review the transactions before importing them into this
              account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm key={account.id} accountId={account.id} />
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="import-history-heading"
        className="grid gap-2.5"
      >
        <h2 id="import-history-heading" className="text-base font-medium">
          Import history
        </h2>
        {imports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No imports yet. Your previews and completed imports will appear
            here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {imports.map((entry) => (
              <li
                key={entry.id}
                className="first:rounded-t-xl last:rounded-b-xl"
              >
                <Link
                  href={`/financial-accounts/${account.id}/imports/${entry.id}`}
                  className="relative flex min-h-[4.25rem] items-center gap-2.5 rounded-[inherit] px-3 py-3 text-sm hover:bg-muted focus-visible:z-10 sm:gap-3 sm:px-4"
                >
                  <FileSpreadsheetIcon
                    aria-hidden="true"
                    size={18}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span className="grid min-w-0 flex-1 gap-1 wrap-anywhere">
                    <span className="font-medium">{entry.filename}</span>
                    {entry.confirmedAt ? (
                      <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Imported
                        </span>
                        <span>
                          {entry.transactionCount}{" "}
                          {entry.transactionCount === 1
                            ? "transaction"
                            : "transactions"}
                          {" · "}
                          <time dateTime={entry.confirmedAt.toISOString()}>
                            {confirmationDate.format(entry.confirmedAt)} UTC
                          </time>
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-(--accent-emphasis)">
                        Ready to review
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon
                    aria-hidden="true"
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
