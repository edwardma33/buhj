import { CredentialsForm } from "../credentials-form"

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in to Buhj</h1>
      <CredentialsForm mode="sign-in" />
    </>
  )
}
