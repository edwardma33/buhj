import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { financialAccount } from "@/lib/db/schema"

const accountSummary = {
  id: financialAccount.id,
  name: financialAccount.name,
  institution: financialAccount.institution,
}

export async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  return session.user.id
}

export async function listFinancialAccounts() {
  const userId = await requireUserId()
  return db
    .select(accountSummary)
    .from(financialAccount)
    .where(eq(financialAccount.userId, userId))
    .orderBy(asc(financialAccount.name), asc(financialAccount.id))
}

export async function getFinancialAccount(accountId: string) {
  const userId = await requireUserId()
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(accountId)) {
    notFound()
  }

  const [account] = await db
    .select(accountSummary)
    .from(financialAccount)
    .where(
      and(
        eq(financialAccount.id, accountId),
        eq(financialAccount.userId, userId)
      )
    )

  if (!account) notFound()
  return account
}
