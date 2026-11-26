import "server-only"

import { and, desc, eq, isNotNull, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  csvImport,
  financialAccount,
  financialTransaction,
} from "@/lib/db/schema"

import { summarizeObservedPay } from "./observed-pay"

export async function getObservedPay(userId: string) {
  const deposits = await db
    .select({
      importId: financialTransaction.importId,
      sourceRow: financialTransaction.sourceRow,
      postedDate: financialTransaction.postedDate,
      amountCents: sql<string>`${financialTransaction.amountCents}::text`,
    })
    .from(financialTransaction)
    .innerJoin(csvImport, eq(financialTransaction.importId, csvImport.id))
    .innerJoin(financialAccount, eq(csvImport.accountId, financialAccount.id))
    .where(
      and(
        eq(financialAccount.userId, userId),
        isNotNull(csvImport.confirmedAt),
        eq(financialTransaction.spendingKind, "regular_pay")
      )
    )
    .orderBy(
      desc(financialTransaction.postedDate),
      financialTransaction.importId,
      financialTransaction.sourceRow
    )

  return summarizeObservedPay(
    deposits.map((deposit) => ({
      ...deposit,
      amountCents: BigInt(deposit.amountCents),
    }))
  )
}
