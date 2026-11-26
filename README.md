# Next.js template

This is a Next.js template with shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```

## Create a signup invite

In your local environment, set `DATABASE_URL` to the app's Postgres connection
string and `BETTER_AUTH_URL` to the app URL your invitee can open. Keep the
database connection string private. Apply the database migrations before you
create the first invite.

```bash
bun run invite:create --hours 24
```

Share the printed URL with the invitee. `--hours` sets the link's lifetime in
whole hours. The link expires after that time or after one successful signup.

## Verify invite signup

Create a disposable local PostgreSQL database named `buhj_auth_test`. Set
`DATABASE_URL` to its connection string and use `127.0.0.1` as the host. Set
`BETTER_AUTH_URL` to `http://127.0.0.1:3000` and set `BETTER_AUTH_SECRET` in the
environment for the app.

Run `bun run db:migrate`, then start the app with
`bun run dev --hostname 127.0.0.1`. In a second terminal with the same database
and app URLs, run `bun test tests/invite-auth.test.ts`. The suite creates test
users and briefly adds a database constraint to simulate a failed signup write.
