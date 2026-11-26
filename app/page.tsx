import config from "./scaffold-config.json"

export default function Page() {
  const features = [
    { name: "Database", value: config.database === "sqlite" ? "SQLite" : "PostgreSQL" },
    { name: "Authentication", value: "Email and password" },
    ...(config.organizations ? [{ name: "Accounts", value: "Organizations and teams" }] : []),
    ...(config.resend ? [{ name: "Authentication emails", value: "Resend" }] : []),
    ...(config.polar ? [{ name: "Billing portal", value: "Polar" }] : []),
  ]

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-16 sm:py-24">
      <h1 className="break-words text-4xl font-semibold tracking-tight sm:text-5xl">{config.name}</h1>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.name} className="rounded-lg border bg-card p-4 text-card-foreground">
            <dt className="text-sm text-muted-foreground">{feature.name}</dt>
            <dd className="mt-1 font-medium">{feature.value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="next-steps" className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground">
        <h2 id="next-steps" className="text-xl font-semibold">Next steps</h2>
        <ol className="list-inside list-decimal space-y-3 text-muted-foreground">
          {config.setup.map((step) => <li key={step}>{step}</li>)}
          <li>Edit <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">app/page.tsx</code> to start building.</li>
        </ol>
      </section>
    </main>
  )
}
