import {
  APIError,
  getCurrentAdapter,
  type BetterAuthOptions,
} from "better-auth"

import { authEmailOptions } from "@/lib/auth/email"
import { organizationPlugins } from "@/lib/auth/organization"
import {
  invalidSignupInviteMessage,
  signupInviteHash,
} from "@/lib/auth/signup-invites"
import type { signupInvite } from "@/lib/db/schema"

const signupInviteModel = "signupInvite"

function invalidSignupInvite() {
  return new APIError("BAD_REQUEST", {
    code: "INVALID_SIGNUP_INVITE",
    message: invalidSignupInviteMessage,
  })
}

export const authOptions = {
  ...authEmailOptions,
  databaseHooks: {
    user: {
      create: {
        async before(_user, context) {
          if (context?.path !== "/sign-up/email") throw invalidSignupInvite()

          const id = signupInviteHash(context.body?.inviteToken)
          if (!id) throw invalidSignupInvite()

          const adapter = await getCurrentAdapter(context.context.adapter)
          if (adapter === context.context.adapter) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Signup requires a database transaction.",
            })
          }

          const invite = await adapter.consumeOne<
            typeof signupInvite.$inferSelect
          >({
            model: signupInviteModel,
            where: [{ field: "id", value: id }],
          })
          if (!invite || invite.expiresAt.getTime() <= Date.now()) {
            throw invalidSignupInvite()
          }
        },
      },
    },
  },
  plugins: [
    ...organizationPlugins,
    {
      id: "signup-invite",
      schema: {
        [signupInviteModel]: {
          fields: { expiresAt: { type: "date", required: true } },
        },
      },
    },
  ],
} satisfies BetterAuthOptions
