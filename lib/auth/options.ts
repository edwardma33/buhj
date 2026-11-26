import { authEmailOptions } from "@/lib/auth/email"
import { organizationPlugins } from "@/lib/auth/organization"

export const authOptions = {
  ...authEmailOptions,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    ...organizationPlugins,
  ],
}
