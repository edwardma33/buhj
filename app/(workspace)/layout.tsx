import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"

import { WorkspaceShell } from "./workspace-shell"

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  return <WorkspaceShell>{children}</WorkspaceShell>
}
