export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-md space-y-5 px-6 py-16">{children}</main>
  )
}
