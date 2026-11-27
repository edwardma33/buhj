import { ChevronRightIcon, LandmarkIcon } from "lucide-react"
import Link from "next/link"

import { AccountCreation } from "./account-form"
import { listFinancialAccounts } from "./accounts"

export default async function FinancialAccountsPage() {
  const accounts = await listFinancialAccounts()

  return (
    <main className="workspace-page workspace-page-narrow grid gap-5">
      <AccountCreation hasAccounts={accounts.length > 0} />
      {accounts.length > 0 && (
        <ul
          aria-label="Financial accounts"
          className="divide-y divide-border rounded-xl border border-border bg-card"
        >
          {accounts.map((account) => (
            <li
              key={account.id}
              className="first:rounded-t-xl last:rounded-b-xl"
            >
              <Link
                href={`/financial-accounts/${account.id}`}
                className="relative flex min-h-[4.25rem] items-center gap-2.5 rounded-[inherit] px-3 py-3 text-sm hover:bg-muted focus-visible:z-10 sm:gap-3 sm:px-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <LandmarkIcon aria-hidden="true" size={18} />
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5 wrap-anywhere">
                  <span className="font-semibold">{account.name}</span>
                  <span className="text-muted-foreground">
                    {account.institution}
                  </span>
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                  size={16}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
