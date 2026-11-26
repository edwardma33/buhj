import "server-only"

import { and, desc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { savedResult } from "@/lib/db/schema"

type ResultSnapshot = typeof savedResult.$inferSelect.snapshot

const draftCutoff = sql<Date>`now() - interval '24 hours'`
const visible = or(
  isNotNull(savedResult.savedAt),
  gt(savedResult.createdAt, draftCutoff)
)

function ownedResult(userId: string, id: string, kind: ResultSnapshot["kind"]) {
  return and(
    eq(savedResult.id, id),
    eq(savedResult.userId, userId),
    eq(savedResult.kind, kind),
    visible
  )
}

export async function createResultDraft(
  userId: string,
  snapshot: ResultSnapshot
) {
  const [result] = await db
    .insert(savedResult)
    .values({ userId, kind: snapshot.kind, snapshot })
    .returning({ id: savedResult.id })
  return result.id
}

export async function getResult(
  userId: string,
  id: string,
  kind: ResultSnapshot["kind"]
) {
  const [result] = await db
    .select()
    .from(savedResult)
    .where(ownedResult(userId, id, kind))
  return result
}

export async function saveResultDraft(
  userId: string,
  id: string,
  kind: ResultSnapshot["kind"]
) {
  const [result] = await db
    .update(savedResult)
    .set({ savedAt: sql`coalesce(${savedResult.savedAt}, now())` })
    .where(ownedResult(userId, id, kind))
    .returning({ id: savedResult.id })
  return result
}

export function listSavedResults(userId: string, kind: ResultSnapshot["kind"]) {
  return db
    .select({
      id: savedResult.id,
      savedAt: savedResult.savedAt,
      scenarioKind: sql<
        string | null
      >`${savedResult.snapshot}->'scenario'->>'kind'`,
      baselineKind: sql<
        string | null
      >`${savedResult.snapshot}->'baseline'->>'kind'`,
      sourcePeriod: sql<
        ResultSnapshot["sourcePeriod"]
      >`${savedResult.snapshot}->'sourcePeriod'`,
    })
    .from(savedResult)
    .where(
      and(
        eq(savedResult.userId, userId),
        eq(savedResult.kind, kind),
        isNotNull(savedResult.savedAt)
      )
    )
    .orderBy(desc(savedResult.savedAt), desc(savedResult.id))
}

export async function deleteExpiredResultDrafts() {
  await db
    .delete(savedResult)
    .where(
      and(isNull(savedResult.savedAt), lte(savedResult.createdAt, draftCutoff))
    )
}
