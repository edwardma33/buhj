import "server-only"

import { lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { aiDailyUsage } from "@/lib/db/schema"

const utcDay = sql<string>`(now() at time zone 'UTC')::date`

function quotaLimit(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback
  const limit = Number(value)
  if (!/^\d+$/.test(value) || limit > 2_147_483_647) {
    throw new Error("Invalid AI daily request limit")
  }
  return limit
}

export async function reserveAiRequest(userId: string) {
  const buckets = [
    {
      bucket: "app",
      limit: quotaLimit(process.env.AI_DAILY_APP_LIMIT, 100),
      scope: "app",
    },
    {
      bucket: `user:${userId}`,
      limit: quotaLimit(process.env.AI_DAILY_USER_LIMIT, 10),
      scope: "user",
    },
  ] as const

  return db
    .transaction(async (tx) => {
      for (const { bucket, limit, scope } of buckets) {
        if (limit === 0) throw new QuotaReached(scope)
        const [reserved] = await tx
          .insert(aiDailyUsage)
          .values({ day: utcDay, bucket, requests: 1 })
          .onConflictDoUpdate({
            target: [aiDailyUsage.day, aiDailyUsage.bucket],
            set: { requests: sql`${aiDailyUsage.requests} + 1` },
            setWhere: lt(aiDailyUsage.requests, limit),
          })
          .returning()
        if (!reserved) throw new QuotaReached(scope)
      }
    })
    .then(
      () => null,
      (error: unknown) => {
        if (error instanceof QuotaReached) return error.scope
        throw error
      }
    )
}

class QuotaReached extends Error {
  constructor(readonly scope: "app" | "user") {
    super("AI daily limit reached")
  }
}

export async function deletePastAiUsage() {
  await db.delete(aiDailyUsage).where(lt(aiDailyUsage.day, utcDay))
}
