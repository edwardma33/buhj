import Link from "next/link"
import { notFound } from "next/navigation"

import { listFinancialAccounts } from "@/app/(workspace)/financial-accounts/accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { CorrectionForm } from "./correction-form"
import {
  categories,
  formatUsd,
  isCategorySpending,
  monthRange,
  summarizeSpending,
} from "./model"
import { listConfirmedSpending } from "./records"

export default async function SpendingPage({
  searchParams,
}: PageProps<"/spending">) {
  const [query, accounts] = await Promise.all([
    searchParams,
    listFinancialAccounts(),
  ])
  const { month, start, end } = monthRange(query.month)
  const account = accounts.find(({ id }) => id === query.account)
  if (query.account && !account) notFound()

  const included = account ? [account] : accounts
  const entries = await listConfirmedSpending(
    included.map(({ id }) => id),
    start,
    end
  )
  const { inflows, outflows, net, categoryTotals } = summarizeSpending(entries)
  const category = categories.find((value) => value === query.category)
  const drilldown =
    query.view === "transfers" ? "transfers" : (category ?? "all")
  const supporting = entries.filter((entry) => {
    if (drilldown === "all") return true
    if (drilldown === "transfers") return entry.kind === "transfer"
    return entry.category === drilldown && isCategorySpending(entry)
  })

  function transactionLink(
    filter?: { category: string } | { view: "transfers" }
  ) {
    const params = new URLSearchParams({ month, ...filter })
    if (account) params.set("account", account.id)
    return "/spending?" + params + "#transactions"
  }

  return (
    <main className="workspace-page space-y-6">
      <Link href="/" className="text-sm underline underline-offset-4">
        Home
      </Link>
      <h1 className="text-3xl font-semibold">Monthly spending</h1>
      <nav
        aria-label="Related spending tools"
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        <Link href="/income" className="text-sm underline underline-offset-4">
          Compare reported and observed pay
        </Link>
        <Link
          href={"/insights?month=" + month}
          className="text-sm underline underline-offset-4"
        >
          Spending Insights for this month
        </Link>
        <Link
          href={"/projections?month=" + month}
          className="text-sm underline underline-offset-4"
        >
          Explore a savings Projection
        </Link>
      </nav>

      <form className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            name="month"
            defaultValue={month}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="account">Financial account</Label>
          <NativeSelect
            id="account"
            name="account"
            defaultValue={account?.id ?? ""}
          >
            <NativeSelectOption value="">All accounts</NativeSelectOption>
            {accounts.map(({ id, name, institution }) => (
              <NativeSelectOption key={id} value={id}>
                {name} ({institution})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Show month</Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {start} to {end} ·{" "}
        {included.map(({ name }) => name).join(", ") || "No financial accounts"}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Inflows", inflows],
            ["Outflows", outflows],
            ["Net cash flow", net],
          ] as const
        ).map(([title, amount]) => (
          <Card key={title} aria-label={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl tabular-nums">
              {formatUsd(amount)}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Internal transfers are excluded. Refunds count as inflows and reduce
        category spending.
      </p>

      <section aria-labelledby="category-heading" className="space-y-2">
        <h2 id="category-heading" className="text-xl font-semibold">
          Spending by category
        </h2>
        {categoryTotals.size === 0 ? (
          <p>No category spending in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Net spending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories
                .filter((value) => categoryTotals.has(value))
                .map((value) => (
                  <TableRow key={value}>
                    <TableCell>
                      <Link
                        href={transactionLink({ category: value })}
                        className="underline underline-offset-4"
                      >
                        {value}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(categoryTotals.get(value) ?? BigInt(0))}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section
        id="transactions"
        aria-labelledby="transaction-heading"
        className="space-y-3"
      >
        <h2 id="transaction-heading" className="text-xl font-semibold">
          {drilldown === "all"
            ? "Transactions"
            : drilldown === "transfers"
              ? "Internal transfers"
              : drilldown + " transactions"}
        </h2>
        <nav aria-label="Transaction views" className="flex gap-4 text-sm">
          <Link
            href={transactionLink()}
            aria-current={drilldown === "all" ? "page" : undefined}
            className="underline underline-offset-4"
          >
            All transactions
          </Link>
          <Link
            href={transactionLink({ view: "transfers" })}
            aria-current={drilldown === "transfers" ? "page" : undefined}
            className="underline underline-offset-4"
          >
            Transfers
          </Link>
        </nav>
        {supporting.length === 0 ? (
          <p>No confirmed transactions in this view.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posted</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Correction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supporting.map((entry) => (
                <TableRow key={entry.importId + ":" + entry.sourceRow}>
                  <TableCell>{entry.postedDate}</TableCell>
                  <TableCell className="max-w-64 break-words whitespace-normal">
                    {entry.description}
                  </TableCell>
                  <TableCell>{entry.accountName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsd(entry.amountCents)}
                  </TableCell>
                  <TableCell>
                    <CorrectionForm
                      key={entry.category + ":" + entry.kind}
                      importId={entry.importId}
                      sourceRow={entry.sourceRow}
                      category={entry.category}
                      kind={entry.kind}
                      credit={entry.amountCents > BigInt(0)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </main>
  )
}
