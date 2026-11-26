import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { createSignupInvite } from "../lib/auth/signup-invites"
import { pool } from "../lib/db"

const origin = new URL(process.env.BETTER_AUTH_URL ?? "")
const database = new URL(process.env.DATABASE_URL ?? "")
assert.equal(origin.hostname, "127.0.0.1", "Run against the local Next.js app")
assert.equal(database.hostname, "127.0.0.1", "Use a disposable local database")
assert.match(database.pathname, /_test$/, "Use a database named *_test")

const runId = randomUUID()
const password = "disposable-invite-test-passphrase"

after(() => pool.end())

function emailFor(label: string) {
  return `${runId}-${label}@example.test`
}

function post(path: string, body: Record<string, unknown>, cookie?: string) {
  const headers = new Headers({
    "content-type": "application/json",
    origin: origin.origin,
  })
  if (cookie) headers.set("cookie", cookie)

  return fetch(new URL(`/api/auth${path}`, origin), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
  })
}

function signUp(email: string, inviteToken?: string) {
  return post("/sign-up/email", {
    name: "Invited user",
    email,
    password,
    inviteToken,
  })
}

function newInvite() {
  return createSignupInvite(new Date(Date.now() + 60 * 60 * 1000))
}

function invitePage(inviteToken: string) {
  const url = new URL("/sign-up", origin)
  url.searchParams.set("invite", inviteToken)
  return fetch(url)
}

function privatePage(cookie?: string) {
  return fetch(origin, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  })
}

function sessionCookie(response: Response) {
  const cookies = response.headers.getSetCookie()
  assert.ok(cookies.length, "Expected a session cookie")
  return cookies.map((value) => value.split(";", 1)[0]).join("; ")
}

async function assertSignedIn(cookie: string, email: string) {
  const response = await privatePage(cookie)
  assert.equal(response.status, 200)
  const html = (await response.text()).replaceAll("<!-- -->", "")
  assert.ok(html.includes(`Signed in as ${email}`))
}

function credentialRows(emails: string[]) {
  return pool.query<{ email: string; provider_id: string | null }>(
    `SELECT u.email, a.provider_id FROM "user" AS u
     LEFT JOIN account AS a ON a.user_id = u.id WHERE u.email = ANY($1)`,
    [emails]
  )
}

test("redirects signed-out visits and rejects a fake session cookie", async () => {
  for (const cookie of [undefined, "better-auth.session_token=invalid"]) {
    const response = await privatePage(cookie)
    assert.equal(response.status, 307)
    assert.equal(response.headers.get("location"), "/sign-in")
  }
})

test("redeems a link and reaches the private app after signup and a fresh sign-in", async () => {
  const inviteToken = await newInvite()
  const signupPage = await invitePage(inviteToken)
  assert.equal(signupPage.status, 200)
  assert.match(await signupPage.text(), /Create account/)

  const email = emailFor("invited")
  const signup = await signUp(email, inviteToken)
  assert.equal(signup.status, 200)
  const cookie = sessionCookie(signup)
  await assertSignedIn(cookie, email)

  const signout = await post("/sign-out", {}, cookie)
  assert.equal(signout.status, 200)
  assert.equal((await privatePage(cookie)).status, 307)

  const signin = await post("/sign-in/email", { email, password })
  assert.equal(signin.status, 200)
  await assertSignedIn(sessionCookie(signin), email)
})

test("rejects missing, malformed, expired and redeemed invites at the signup endpoint", async () => {
  const expired = await createSignupInvite(new Date(Date.now() - 60_000))
  const spent = await newInvite()
  assert.equal((await signUp(emailFor("original"), spent)).status, 200)

  const cases = {
    missing: undefined,
    malformed: "invalid",
    expired,
    redeemed: spent,
  }
  for (const [label, token] of Object.entries(cases)) {
    const response = await signUp(emailFor(label), token)
    assert.equal(response.status, 400, label)
    assert.equal((await response.json()).code, "INVALID_SIGNUP_INVITE", label)
    assert.equal(response.headers.get("set-cookie"), null, label)
  }

  for (const inviteToken of ["", expired, spent]) {
    assert.match(
      await (await invitePage(inviteToken)).text(),
      /Ask the operator for a new link/
    )
  }
  assert.equal(
    (await credentialRows(Object.keys(cases).map(emailFor))).rowCount,
    0
  )
})

test("creates exactly one credential account when two requests redeem the same invite", async () => {
  const inviteToken = await newInvite()
  const emails = [emailFor("racer-one"), emailFor("racer-two")]
  const results = await Promise.all(
    emails.map((email) => signUp(email, inviteToken))
  )

  assert.deepEqual(results.map((result) => result.status).sort(), [200, 400])
  const winner = results.findIndex((result) => result.ok)
  assert.equal((await results[1 - winner].json()).code, "INVALID_SIGNUP_INVITE")
  assert.deepEqual((await credentialRows(emails)).rows, [
    { email: emails[winner], provider_id: "credential" },
  ])
})

test("restores the invite and user state when writing credentials fails", async () => {
  const email = emailFor("retry")
  const inviteToken = await newInvite()
  assert.match(await (await invitePage(inviteToken)).text(), /Create account/)

  await pool.query(`ALTER TABLE account ADD CONSTRAINT invite_test_block_credentials
    CHECK (provider_id <> 'credential') NOT VALID`)
  try {
    assert.equal((await signUp(email, inviteToken)).status, 500)
    assert.equal((await credentialRows([email])).rowCount, 0)
    assert.match(await (await invitePage(inviteToken)).text(), /Create account/)
  } finally {
    await pool.query(
      "ALTER TABLE account DROP CONSTRAINT invite_test_block_credentials"
    )
  }

  assert.equal((await signUp(email, inviteToken)).status, 200)
})

test("rejects Google OAuth initiation and direct identity-token signup", async () => {
  const start = await post("/sign-in/social", {
    provider: "google",
    requestSignUp: true,
  })
  assert.equal(start.status, 404)
  assert.equal((await start.json()).code, "PROVIDER_NOT_FOUND")

  const idToken = await post("/sign-in/social", {
    provider: "google",
    requestSignUp: true,
    idToken: { token: "test-id-token" },
  })
  assert.equal(idToken.status, 404)
  assert.equal((await idToken.json()).code, "PROVIDER_NOT_FOUND")

  const callback = await fetch(new URL("/api/auth/callback/google", origin), {
    redirect: "manual",
  })
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.get("set-cookie"), null)
})
