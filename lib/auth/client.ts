import { createAuthClient } from "better-auth/react"
import { organizationClientPlugins } from "@/lib/auth/organization-client"

export const authClient = createAuthClient({ plugins: [...organizationClientPlugins] })
