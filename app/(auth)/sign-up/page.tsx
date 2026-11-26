import type { Metadata } from "next"
import Link from "next/link"

import {
  invalidSignupInviteMessage,
  isSignupInviteUsable,
} from "@/lib/auth/signup-invites"
import { CredentialsForm } from "../credentials-form"

export const metadata: Metadata = { referrer: "no-referrer" }

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const { invite } = await searchParams
  const token = typeof invite === "string" ? invite : undefined
  const isUsable = token && (await isSignupInviteUsable(token))

  return (
    <>
      <h1 className="text-2xl font-semibold">Create your Buhj account</h1>
      {isUsable ? (
        <CredentialsForm mode="sign-up" inviteToken={token} />
      ) : (
        <p>{invalidSignupInviteMessage}</p>
      )}
      <Link className="text-sm underline underline-offset-4" href="/sign-in">
        Sign in
      </Link>
    </>
  )
}
