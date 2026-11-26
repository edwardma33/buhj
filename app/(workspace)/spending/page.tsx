import {
  CarFrontIcon,
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  HeartPulseIcon,
  HouseIcon,
  PlaneIcon,
  PlugIcon,
  ShoppingBagIcon,
  ShoppingBasketIcon,
  TagIcon,
  TicketIcon,
  UtensilsIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { listFinancialAccounts } from "@/app/(workspace)/financial-accounts/accounts"
import { Button } from "@/components/ui/button"
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

import { TransactionEditor } from "./correction-form"
import {
  categories,
  formatUsd,
  isCategorySpending,
  monthRange,
  summarizeSpending,
  spendingKinds,
} from "./model"
import { listConfirmedSpending } from "./records"
import styles from "./ledger.module.css"

const categoryIcons = {
  Uncategorized: TagIcon,
  Groceries: ShoppingBasketIcon,
  Dining: UtensilsIcon,
  Housing: HouseIcon,
  Utilities: PlugIcon,
  Transportation: CarFrontIcon,
  Health: HeartPulseIcon,
  Shopping: ShoppingBagIcon,
  Entertainment: TicketIcon,
  Travel: PlaneIcon,
  Other: EllipsisIcon,
} satisfies Record<(typeof categories)[number], LucideIcon>

const cashFlowLabels = {
  inflows: "Inflows",
  outflows: "Outflows",
  net: "Net cash flow",
}
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const rangeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

function postedDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function signedUsd(cents: bigint) {
  if (cents < 0) return `−${formatUsd(-cents)}`
  return cents > 0 ? `+${formatUsd(cents)}` : formatUsd(cents)
}

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
  const entries = await listConfirmedSpending(
    account ? [account.id] : accounts.map(({ id }) => id),
    start,
    end
  )
  const { inflows, outflows, net, categoryTotals } = summarizeSpending(entries)
  const view = query.view
  const transfers = view === "transfers"
  const cashFlow = view === "inflows" || view === "outflows" || view === "net"
  const category =
    !transfers && !cashFlow
      ? categories.find((name) => name === query.category)
      : undefined
  const selection = transfers
    ? "Internal transfers"
    : cashFlow
      ? cashFlowLabels[view]
      : category
  const supporting = entries.filter((entry) => {
    if (transfers) return entry.kind === "transfer"
    if (cashFlow) {
      if (entry.kind === "transfer") return false
      if (view === "inflows") return entry.amountCents > BigInt(0)
      if (view === "outflows") return entry.amountCents < BigInt(0)
      return entry.amountCents !== BigInt(0)
    }
    return (
      !category || (entry.category === category && isCategorySpending(entry))
    )
  })
  const rankedCategories = Array.from(categoryTotals).sort(
    ([, first], [, second]) => (first > second ? -1 : first < second ? 1 : 0)
  )

  function reportLink(
    filter?:
      | { category: string }
      | { view: "transfers" | "inflows" | "outflows" | "net" }
  ) {
    const params = new URLSearchParams({ month, ...filter })
    if (account) params.set("account", account.id)
    return `/spending?${params}`
  }

  return (
    <main className={`workspace-page ${styles.report}`}>
      <div className={styles.heading}>
        <div className="min-w-0 wrap-anywhere">
          <h1>Monthly spending</h1>
          <p className={styles.period}>
            {rangeFormat.formatRange(postedDate(start), postedDate(end))}
            <span>
              {account?.name ??
                (accounts.length ? "All accounts" : "No financial accounts")}
            </span>
          </p>
        </div>
        <form className={styles.filters} action="/spending">
          <Label className="sr-only" htmlFor="spending-month">
            Month
          </Label>
          <Input
            key={month}
            id="spending-month"
            name="month"
            type="month"
            defaultValue={month}
            required
          />
          <Label className="sr-only" htmlFor="spending-account">
            Financial account
          </Label>
          <NativeSelect
            key={account?.id ?? "all"}
            id="spending-account"
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
          <Button variant="outline" type="submit">
            Apply
          </Button>
        </form>
      </div>

      <dl className={styles.metrics} aria-label="Monthly cash flow">
        {(
          [
            ["inflows", inflows],
            ["outflows", -outflows],
            ["net", net],
          ] as const
        ).map(([kind, amount]) => (
          <div
            key={kind}
            data-net={
              kind === "net" ? (net < 0 ? "negative" : "net") : undefined
            }
          >
            <dt>{cashFlowLabels[kind]}</dt>
            <dd>
              <Link
                href={reportLink({ view: kind }) + "#transactions"}
                aria-current={view === kind ? "true" : undefined}
              >
                <span className="sr-only">
                  {cashFlowLabels[kind]} transactions{" "}
                </span>
                <span>{signedUsd(amount)}</span>
                <ChevronRightIcon aria-hidden="true" size={16} />
              </Link>
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.ledger}>
        <section
          className={styles.categories}
          aria-labelledby="spending-categories"
        >
          <div className={styles.panelHeader}>
            <h2 id="spending-categories">Spending by category</h2>
          </div>
          {rankedCategories.length ? (
            <>
              <div className={styles.categoryHeader} aria-hidden="true">
                <span>Category</span>
                <span>Net spending</span>
              </div>
              <ul className={styles.categoryList}>
                {rankedCategories.map(([name, amount]) => {
                  const selected = category === name
                  const CategoryIcon = categoryIcons[name]
                  return (
                    <li key={name}>
                      <Link
                        href={reportLink({ category: name }) + "#transactions"}
                        aria-current={selected || undefined}
                      >
                        <span className={styles.categoryLabel}>
                          <CategoryIcon size={16} aria-hidden="true" />
                          <span>{name}</span>
                        </span>
                        {selected && (
                          <CheckIcon
                            className={styles.categoryCheck}
                            size={14}
                            aria-hidden="true"
                          />
                        )}
                        <span className={styles.amount}>
                          {formatUsd(amount)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className={styles.state}>
              No category spending for these filters.
            </p>
          )}
        </section>

        <section
          id="transactions"
          tabIndex={-1}
          className={styles.transactions}
          aria-labelledby="transaction-title"
        >
          <div className={styles.panelHeader}>
            <h2 id="transaction-title">Transactions</h2>
            {selection && (
              <Link
                href={reportLink()}
                scroll={false}
                className={styles.categoryFilter}
                aria-label={`Clear ${selection} filter`}
              >
                {selection} <XIcon aria-hidden="true" size={13} />
              </Link>
            )}
          </div>
          <nav className={styles.views} aria-label="Transaction views">
            <Link
              href={reportLink()}
              scroll={false}
              aria-current={!selection ? "page" : undefined}
            >
              All transactions
            </Link>
            <Link
              href={reportLink({ view: "transfers" })}
              scroll={false}
              aria-current={transfers ? "page" : undefined}
            >
              Transfers
            </Link>
          </nav>
          {supporting.length ? (
            <Table
              aria-label={
                transfers
                  ? "Internal transfers"
                  : selection
                    ? `${selection} transactions`
                    : "Confirmed transactions"
              }
              className={styles.table}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Posted</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className={styles.accountColumn}>
                    Account
                  </TableHead>
                  <TableHead className={styles.amount}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supporting.map((entry) => (
                  <TableRow key={`${entry.importId}:${entry.sourceRow}`}>
                    <TableCell className={styles.secondary}>
                      <time dateTime={entry.postedDate}>
                        {dateFormat.format(postedDate(entry.postedDate))}
                      </time>
                    </TableCell>
                    <TableCell className={styles.description}>
                      <span>{entry.description}</span>
                      {(entry.kind !== "activity" || !category) && (
                        <span className={styles.refund}>
                          {entry.kind === "activity"
                            ? entry.category
                            : spendingKinds[entry.kind]}
                        </span>
                      )}
                      <span className={styles.mobileAccount}>
                        {entry.accountName}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`${styles.secondary} ${styles.accountColumn}`}
                    >
                      {entry.accountName}
                    </TableCell>
                    <TableCell className={styles.amount}>
                      <div className="flex flex-col items-end">
                        <span>{signedUsd(entry.amountCents)}</span>
                        <TransactionEditor
                          importId={entry.importId}
                          sourceRow={entry.sourceRow}
                          description={entry.description}
                          posted={dateFormat.format(
                            postedDate(entry.postedDate)
                          )}
                          accountName={entry.accountName}
                          amount={signedUsd(entry.amountCents)}
                          category={entry.category}
                          kind={entry.kind}
                          credit={entry.amountCents > BigInt(0)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className={styles.state}>
              <p>
                {selection
                  ? "No confirmed transactions in this view."
                  : "No confirmed transactions for these filters."}
              </p>
              {selection ? (
                <Link href={reportLink()} scroll={false}>
                  Show all transactions
                </Link>
              ) : accounts.length === 0 ? (
                <Link href="/financial-accounts">Add a financial account</Link>
              ) : account ? (
                <Link href={`/spending?month=${month}`}>Show all accounts</Link>
              ) : (
                <Link href="#spending-month">Choose another month</Link>
              )}
            </div>
          )}
          {supporting.length > 0 && (
            <div className={styles.registerFooter}>
              <span>
                {supporting.length}{" "}
                {supporting.length === 1 ? "transaction" : "transactions"}
              </span>
              {selection && (
                <strong className={styles.amount}>
                  {signedUsd(
                    supporting.reduce(
                      (sum, entry) => sum + entry.amountCents,
                      BigInt(0)
                    )
                  )}
                </strong>
              )}
            </div>
          )}
        </section>
      </div>
      <p className={styles.context}>
        Cash flow excludes internal transfers. Refunds count as inflows and
        reduce category spending.
      </p>
      <nav
        aria-label="Related spending tools"
        className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
      >
        <Link href="/income" className="hover:underline">
          Compare reported and observed pay
        </Link>
        <Link href={`/insights?month=${month}`} className="hover:underline">
          Spending Insights
        </Link>
        <Link href={`/projections?month=${month}`} className="hover:underline">
          Savings Projections
        </Link>
      </nav>
    </main>
  )
}
