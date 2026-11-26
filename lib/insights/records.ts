import "server-only"

import { and, desc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { savedResult } from "@/lib/db/schema"

import type { InsightSnapshot } from "./model"

const draftCutoff = sql<Date>`now() - interval '24 hours'`
const visible = or(
  isNotNull(savedResult.savedAt),
  gt(savedResult.createdAt, draftCutoff)
)

function ownedInsight(userId: string, id: string) {
  return and(
    eq(savedResult.id, id),
    eq(savedResult.userId, userId),
    eq(savedResult.kind, "insight"),
    visible
  )
}

export async function createInsightDraft(
  userId: string,
  snapshot: InsightSnapshot
) {
  const [result] = await db
    .insert(savedResult)
    .values({ userId, kind: snapshot.kind, snapshot })
    .returning({ id: savedResult.id })
  return result.id
}

export async function getInsight(userId: string, id: string) {
  const [result] = await db
    .select()
    .from(savedResult)
    .where(ownedInsight(userId, id))
  return result
}

export async function saveInsightDraft(userId: string, id: string) {
  const [result] = await db
    .update(savedResult)
    .set({ savedAt: sql`coalesce(${savedResult.savedAt}, now())` })
    .where(ownedInsight(userId, id))
    .returning({ id: savedResult.id })
  return result
}

export function listSavedInsights(userId: string) {
  return db
    .select({
      id: savedResult.id,
      savedAt: savedResult.savedAt,
      sourcePeriod: sql<
        InsightSnapshot["sourcePeriod"]
      >`${savedResult.snapshot}->'sourcePeriod'`,
    })
    .from(savedResult)
    .where(
      and(
        eq(savedResult.userId, userId),
        eq(savedResult.kind, "insight"),
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
