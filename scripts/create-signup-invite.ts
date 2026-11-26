import { createSignupInvite } from "@/lib/auth/signup-invites"
import { pool } from "@/lib/db"

try {
  const [flag, value = "", ...extra] = process.argv.slice(2)
  const hours = Number(value)
  const expiresAt = new Date(Date.now() + hours * 3_600_000)
  if (
    flag !== "--hours" ||
    extra.length ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isFinite(expiresAt.getTime())
  ) {
    throw new Error("Usage: bun run invite:create --hours <positive integer>")
  }

  const baseUrl = URL.parse(process.env.BETTER_AUTH_URL ?? "")
  if (
    !baseUrl ||
    !["https:", "http:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("Set BETTER_AUTH_URL to the app's HTTP or HTTPS URL.")
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Set DATABASE_URL to the app's Postgres connection string.")
  }

  const signupUrl = new URL("/sign-up", baseUrl)
  try {
    signupUrl.searchParams.set("invite", await createSignupInvite(expiresAt))
  } catch {
    throw new Error(
      "Could not save the invite. Check the database connection and migrations."
    )
  }
  console.log(signupUrl.href)
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Could not create an invite."
  )
  process.exitCode = 1
} finally {
  await pool.end()
}
