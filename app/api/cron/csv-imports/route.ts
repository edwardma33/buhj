import { timingSafeEqual } from "node:crypto"

import { deletePastAiUsage } from "@/lib/ai/quota"
import { deleteExpiredPreviews } from "@/lib/csv-import/imports"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return new Response(null, { status: 401 })
  const expected = Buffer.from(`Bearer ${secret}`)
  const authorization = Buffer.from(request.headers.get("authorization") ?? "")
  if (
    authorization.length !== expected.length ||
    !timingSafeEqual(authorization, expected)
  ) {
    return new Response(null, { status: 401 })
  }

  await deleteExpiredPreviews()
  await deletePastAiUsage()
  return new Response(null, { status: 204 })
}
