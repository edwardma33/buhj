import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { authOptions } from "@/lib/auth/options"

export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { provider: "pg", schema }),
})
