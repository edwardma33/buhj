"use server"

import { and, eq, gt, inArray, isNotNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { requireUserId, validUuid } from "@/app/financial-accounts/accounts"
import { db } from "@/lib/db"
import {
  csvImport,
  financialAccount,
  financialTransaction,
} from "@/lib/db/schema"

import { spendingCategory, spendingKind } from "./model"

export async function correctTransaction(
  _previous: string,
  formData: FormData
) {
  const userId = await requireUserId()
  const importId = formData.get("importId")
  const sourceRow = Number(formData.get("sourceRow"))
  const category = formData.get("category")
  const kind = spendingKind(formData.get("kind"))

  if (
    typeof importId !== "string" ||
    !validUuid(importId) ||
    !Number.isInteger(sourceRow) ||
    sourceRow < 1 ||
    sourceRow > 2_147_483_647 ||
    spendingCategory(category) !== category ||
    !kind
  ) {
    return "Check the transaction category and type."
  }

  const confirmedImports = db
    .select({ id: csvImport.id })
    .from(csvImport)
    .innerJoin(financialAccount, eq(csvImport.accountId, financialAccount.id))
    .where(
      and(eq(financialAccount.userId, userId), isNotNull(csvImport.confirmedAt))
    )

  const [updated] = await db
    .update(financialTransaction)
    .set({ category, spendingKind: kind })
    .where(
      and(
        eq(financialTransaction.importId, importId),
        eq(financialTransaction.sourceRow, sourceRow),
        inArray(financialTransaction.importId, confirmedImports),
        kind === "refund" ? gt(financialTransaction.amountCents, 0) : undefined
      )
    )
    .returning({ sourceRow: financialTransaction.sourceRow })

  if (!updated) return "This transaction could not be updated."

  revalidatePath("/spending")
  return ""
}
