import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { incomeProfile } from "@/lib/db/schema"
import { getObservedPay } from "@/lib/observed-pay-records"

import type { PayBaseline } from "./model"

export async function getProjectionPay(
  userId: string,
  kind: PayBaseline["kind"]
): Promise<PayBaseline | null> {
  if (kind === "observed") {
    const { cadence, sampleSize } = await getObservedPay(userId)
    return cadence.status === "supported"
      ? {
          kind,
          schedule: cadence.paySchedule,
          paycheckCents: cadence.takeHomePerPaycheckCents.toString(),
          sampleSize,
          latestPayday: cadence.latestPayday,
        }
      : null
  }

  const profile = await db.query.incomeProfile.findFirst({
    where: eq(incomeProfile.userId, userId),
    columns: { paySchedule: true, takeHomePerPaycheckCents: true },
  })
  return profile
    ? {
        kind,
        schedule: profile.paySchedule,
        paycheckCents: profile.takeHomePerPaycheckCents.toString(),
      }
    : null
}
