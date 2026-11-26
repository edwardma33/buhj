import "server-only"

import { and, desc, eq, isNotNull, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { csvImport, financialTransaction } from "@/lib/db/schema"

const now = sql`clock_timestamp()`
const active = sql`${csvImport.expiresAt} > ${now}`

export async function deleteExpiredPreviews(accountId?: string) {
  await db
    .delete(csvImport)
    .where(
      and(
        lte(csvImport.expiresAt, now),
        accountId === undefined ? undefined : eq(csvImport.accountId, accountId)
      )
    )
}

export async function findExistingImport(
  accountId: string,
  fingerprint: string
) {
  const [entry] = await db
    .select({ id: csvImport.id })
    .from(csvImport)
    .where(
      and(
        eq(csvImport.accountId, accountId),
        eq(csvImport.fingerprint, fingerprint),
        or(isNotNull(csvImport.confirmedAt), active)
      )
    )
  return entry?.id
}

export async function savePreview(entry: {
  accountId: string
  fingerprint: string
  filename: string
  preview: NonNullable<typeof csvImport.$inferInsert.preview>
}) {
  const [saved] = await db
    .insert(csvImport)
    .values({
      ...entry,
      expiresAt: sql`${now} + interval '30 minutes'`,
    })
    .onConflictDoUpdate({
      target: [csvImport.accountId, csvImport.fingerprint],
      set: { fingerprint: entry.fingerprint },
    })
    .returning({ id: csvImport.id })
  return saved.id
}

export function listCsvImports(accountId: string) {
  return db
    .select({
      id: csvImport.id,
      filename: csvImport.filename,
      confirmedAt: csvImport.confirmedAt,
      transactionCount: csvImport.transactionCount,
    })
    .from(csvImport)
    .where(
      and(
        eq(csvImport.accountId, accountId),
        or(isNotNull(csvImport.confirmedAt), active)
      )
    )
    .orderBy(
      desc(sql`coalesce(${csvImport.confirmedAt}, ${csvImport.expiresAt})`)
    )
}

function importScope(accountId: string, importId: string) {
  return and(eq(csvImport.accountId, accountId), eq(csvImport.id, importId))
}

export async function getCsvImport(accountId: string, importId: string) {
  const [entry] = await db
    .select()
    .from(csvImport)
    .where(
      and(
        importScope(accountId, importId),
        or(isNotNull(csvImport.confirmedAt), active)
      )
    )
  return entry
}

export function listImportTransactions(importId: string) {
  return db
    .select()
    .from(financialTransaction)
    .where(eq(financialTransaction.importId, importId))
    .orderBy(financialTransaction.sourceRow)
}

export async function confirmCsvImport(accountId: string, importId: string) {
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(csvImport)
      .where(importScope(accountId, importId))
      .for("update")
    if (entry?.confirmedAt) return "confirmed"
    if (!entry?.preview) return "unavailable"

    const accepted = entry.preview.rows.flatMap((row) =>
      "transaction" in row
        ? [{ ...row.transaction, importId, sourceRow: row.row }]
        : []
    )
    if (accepted.length === 0) return "empty"

    const [confirmed] = await tx
      .update(csvImport)
      .set({
        preview: null,
        expiresAt: null,
        confirmedAt: now,
        transactionCount: accepted.length,
      })
      .where(and(importScope(accountId, importId), active))
      .returning({ id: csvImport.id })
    if (!confirmed) return "unavailable"

    await tx.insert(financialTransaction).values(accepted)
    return "confirmed"
  })
}

export async function cancelCsvImport(accountId: string, importId: string) {
  await db
    .delete(csvImport)
    .where(
      and(importScope(accountId, importId), isNotNull(csvImport.expiresAt))
    )
}
