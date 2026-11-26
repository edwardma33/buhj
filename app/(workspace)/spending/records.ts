import "server-only"

import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  csvImport,
  financialTransaction,
  financialAccount,
} from "@/lib/db/schema"

import { spendingCategory } from "./model"

export async function listConfirmedSpending(
  accountIds: string[],
  start: string,
  end: string
) {
  if (accountIds.length === 0) return []

  const rows = await db
    .select({
      importId: financialTransaction.importId,
      sourceRow: financialTransaction.sourceRow,
      postedDate: financialTransaction.postedDate,
      description: financialTransaction.description,
      amountCents: sql<string>`${financialTransaction.amountCents}::text`,
      category: financialTransaction.category,
      kind: financialTransaction.spendingKind,
      accountName: financialAccount.name,
    })
    .from(financialTransaction)
    .innerJoin(csvImport, eq(financialTransaction.importId, csvImport.id))
    .innerJoin(financialAccount, eq(csvImport.accountId, financialAccount.id))
    .where(
      and(
        inArray(csvImport.accountId, accountIds),
        isNotNull(csvImport.confirmedAt),
        gte(financialTransaction.postedDate, start),
        lte(financialTransaction.postedDate, end)
      )
    )
    .orderBy(
      desc(financialTransaction.postedDate),
      financialTransaction.importId,
      financialTransaction.sourceRow
    )

  return rows.map((row) => ({
    ...row,
    amountCents: BigInt(row.amountCents),
    category: spendingCategory(row.category),
  }))
}
