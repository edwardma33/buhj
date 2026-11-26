import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"
import { SignOutButton } from "./sign-out-button"

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-16">
      <h1 className="text-3xl font-semibold">Buhj</h1>
      <p>Signed in as {session.user.email}</p>
      <p>
        <Link href="/income" className="underline underline-offset-4">
          Income profile
        </Link>
      </p>
      <p>
        <Link
          href="/financial-accounts"
          className="underline underline-offset-4"
        >
          Financial accounts
        </Link>
      </p>
      <p>
        <Link href="/spending" className="underline underline-offset-4">
          Monthly spending
        </Link>
      </p>
      <SignOutButton />
    </main>
  )
}
