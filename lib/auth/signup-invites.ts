import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt } from "drizzle-orm"

import { db } from "@/lib/db"
import { signupInvite } from "@/lib/db/schema"

export const invalidSignupInviteMessage =
  "This signup link is invalid, expired, or already used. Ask the operator for a new link."

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function signupInviteHash(token: unknown) {
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) return null

  return hashToken(token)
}

export async function createSignupInvite(expiresAt: Date) {
  const token = randomBytes(32).toString("base64url")
  await db.insert(signupInvite).values({ id: hashToken(token), expiresAt })
  return token
}

export async function isSignupInviteUsable(token: unknown) {
  const id = signupInviteHash(token)
  if (!id) return false

  const [invite] = await db
    .select({ id: signupInvite.id })
    .from(signupInvite)
    .where(and(eq(signupInvite.id, id), gt(signupInvite.expiresAt, new Date())))
  return Boolean(invite)
}
