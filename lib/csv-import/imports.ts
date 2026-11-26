import "server-only"

import { and, desc, eq, inArray, isNotNull, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  csvImport,
  financialAccount,
  financialTransaction,
} from "@/lib/db/schema"

import { resolveRow, type PreviewRow, type TransactionData } from "./csv"

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

type ImportReader = Pick<typeof db, "select">

function transactionKey(transaction: TransactionData) {
  return JSON.stringify([
    transaction.postedDate,
    transaction.description.trim().replace(/\s+/g, " ").toLowerCase(),
    transaction.amountCents,
  ])
}

export async function reviewOverlaps(
  accountId: string,
  rows: PreviewRow[],
  reader: ImportReader = db
) {
  const transactions = rows.flatMap((row) =>
    "transaction" in row ? [row.transaction] : []
  )
  const dates = [...new Set(transactions.map((row) => row.postedDate))]
  const ids = [
    ...new Set(
      transactions.flatMap((row) =>
        row.sourceId === null ? [] : [row.sourceId]
      )
    ),
  ]
  const matches = dates.length
    ? await reader
        .select({
          postedDate: financialTransaction.postedDate,
          description: financialTransaction.description,
          amountCents: financialTransaction.amountCents,
          sourceId: financialTransaction.sourceId,
        })
        .from(financialTransaction)
        .innerJoin(csvImport, eq(financialTransaction.importId, csvImport.id))
        .where(
          and(
            eq(csvImport.accountId, accountId),
            or(
              inArray(financialTransaction.postedDate, dates),
              ids.length
                ? inArray(financialTransaction.sourceId, ids)
                : undefined
            )
          )
        )
    : []

  const seenIds = new Set(matches.map((match) => match.sourceId))
  const existing = new Set(matches.map(transactionKey))
  const withoutIds = new Set(
    matches.filter((match) => match.sourceId === null).map(transactionKey)
  )
  const overlaps = new Map<number, "duplicate" | "possible">()
  for (const row of rows) {
    if (!("transaction" in row)) continue
    const { sourceId } = row.transaction
    if (sourceId !== null && seenIds.has(sourceId)) {
      overlaps.set(row.row, "duplicate")
      continue
    }
    if (sourceId !== null) seenIds.add(sourceId)
    const comparable = sourceId === null ? existing : withoutIds
    if (comparable.has(transactionKey(row.transaction))) {
      overlaps.set(row.row, "possible")
    }
  }
  return overlaps
}

export async function correctCsvRow(
  accountId: string,
  importId: string,
  sourceRow: number,
  fields: FormData
) {
  return db.transaction(async (tx) => {
    const scope = and(importScope(accountId, importId), active)
    const [entry] = await tx.select().from(csvImport).where(scope).for("update")
    const preview = entry?.preview
    const row = preview?.rows.find((row) => row.row === sourceRow)
    if (!preview || !row || !("correction" in row)) return "unavailable"
    const corrected = resolveRow(row, fields.get("date"), fields.get("amount"))
    if (!corrected) return "invalid"
    const [saved] = await tx
      .update(csvImport)
      .set({
        preview: {
          ...preview,
          rows: preview.rows.map((row) =>
            row.row === sourceRow ? corrected : row
          ),
        },
      })
      .where(scope)
      .returning({ id: csvImport.id })
    return saved ? "saved" : "unavailable"
  })
}

export async function confirmCsvImport(
  accountId: string,
  importId: string,
  corrections: number,
  fields: FormData
) {
  return db.transaction(async (tx) => {
    // Distinct previews can confirm concurrently. Lock the account before reading its transactions.
    const [account] = await tx
      .select({ id: financialAccount.id })
      .from(financialAccount)
      .where(eq(financialAccount.id, accountId))
      .for("no key update")
    if (!account) return "unavailable"
    const [entry] = await tx
      .select()
      .from(csvImport)
      .where(
        and(
          importScope(accountId, importId),
          or(isNotNull(csvImport.confirmedAt), active)
        )
      )
      .for("update")
    if (entry?.confirmedAt) return "confirmed"
    if (!entry?.preview) return "unavailable"

    if (
      entry.preview.rows.filter((row) => "correction" in row).length !==
      corrections
    )
      return "changed"
    const overlaps = await reviewOverlaps(accountId, entry.preview.rows, tx)
    const accepted = []
    for (const row of entry.preview.rows) {
      if (!("transaction" in row)) continue
      const overlap = overlaps.get(row.row)
      if (overlap === "duplicate") continue
      if (overlap === "possible") {
        const choice = fields.get(`overlap-${row.row}`)
        if (choice === "skip") continue
        if (choice !== "keep") return "review"
      }
      accepted.push({ ...row.transaction, importId, sourceRow: row.row })
    }
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
