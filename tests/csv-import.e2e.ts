import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import { chromium, type Page } from "playwright"

import { createSignupInvite } from "../lib/auth/signup-invites"
import { pool } from "../lib/db"

const database = new URL(process.env.DATABASE_URL ?? "")
assert.equal(database.hostname, "127.0.0.1", "Use a disposable local database")
assert.match(database.pathname, /_test$/, "Use a fresh database named *_test")

const origin = "http://127.0.0.1:34152"
const fakeKey = "synthetic-csv-import-provider-key"
const cronSecret = randomUUID()
const calls: Array<{ model: string; store: boolean; input: unknown }> = []
let failProvider = false
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    assert.equal(new URL(request.url).pathname, "/v1/responses")
    assert.equal(request.headers.get("authorization"), `Bearer ${fakeKey}`)
    const body = await request.json()
    calls.push(body)
    if (failProvider)
      return new Response("private provider diagnostic", { status: 502 })
    const sample = JSON.stringify(
      body.input.filter((message: { role: string }) => message.role === "user")
    )
    const mapping =
      sample.includes("[redacted header]") && !sample.includes("posted")
        ? null
        : sample.includes("debit")
          ? { date: 0, description: 1, debit: 2, credit: 3, sourceId: 4 }
          : {
              date: 0,
              description: 1,
              amount: 2,
              sourceId: 3,
              sign: "positive-inflow",
            }
    return Response.json({
      id: "resp_test",
      model: "gpt-6-luna",
      output: [
        {
          id: "msg_test",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ mapping }),
              annotations: [],
            },
          ],
        },
      ],
    })
  },
})

const server = Bun.spawn(
  [
    "node",
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "34152",
  ],
  {
    env: {
      ...process.env,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      OPENAI_API_KEY: fakeKey,
      OPENAI_BASE_URL: `http://127.0.0.1:${provider.port}/v1`,
      AI_DAILY_USER_LIMIT: "5",
      AI_DAILY_APP_LIMIT: "7",
      CRON_SECRET: cronSecret,
    },
    stdout: "inherit",
    stderr: "inherit",
  }
)

const browser = await chromium.launch()
try {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(origin, { redirect: "manual" }).catch(
      () => null
    )
    if (response?.status === 307) break
    assert.ok(attempt < 120, "Next.js did not start")
    await setTimeout(250)
  }

  async function signedInPage(label: string) {
    const context = await browser.newContext({ baseURL: origin })
    context.setDefaultTimeout(12_000)
    const email = `${label}-${randomUUID()}@example.test`
    const signup = await fetch(origin + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        email,
        name: label,
        password: "disposable-test-password",
        inviteToken: await createSignupInvite(new Date(Date.now() + 600_000)),
      }),
    })
    assert.equal(signup.status, 200, await signup.text())
    await context.addCookies(
      signup.headers.getSetCookie().map((cookie) => {
        const [name, ...value] = cookie.split(";")[0].split("=")
        return { name, value: value.join("="), url: origin }
      })
    )
    return context.newPage()
  }

  async function createAccount(page: Page, name: string) {
    await page.goto("/financial-accounts")
    await page.getByRole("button", { name: "Add account" }).click()
    await page.getByLabel("Account name").fill(name)
    await page
      .getByLabel("Institution")
      .selectOption({ label: "Other institution" })
    await page.getByLabel("Institution name").fill("Synthetic Bank")
    await page.getByRole("button", { name: "Create account" }).click()
    await page.waitForURL(/\/financial-accounts\/[^/]+$/)
    return new URL(page.url()).pathname
  }

  const owner = await signedInPage("Owner")
  const guest = await signedInPage("Guest")
  const account = await createAccount(owner, "Owned checking")
  const secondAccount = await createAccount(owner, "Owned savings")
  const guestAccount = await createAccount(guest, "Guest checking")

  const csv = [
    "Posted Date,Description,Amount,Transaction ID,Jane Smith,Account Number,Currency",
    '2026-10-10,"Pay, Inc.",+1500.00,SOURCE-001,Jane Smith,111122223333,USD',
    '2026-10-11,"Coffee ""Shop""",-5.25,SOURCE-002,Jane Smith,111122223333,USD',
    "10/11/2026,Ambiguous,-3.00,SOURCE-003,Jane Smith,111122223333,USD",
    "2026-10-12,Foreign,45.00,SOURCE-004,Jane Smith,111122223333,EUR",
    "2026-02-30,Invalid,three,SOURCE-005,Jane Smith,111122223333,USD",
  ].join("\r\n")

  async function upload(
    page: Page,
    accountPath: string,
    contents: string,
    name = "synthetic.csv"
  ) {
    await page.goto(accountPath)
    await page.getByLabel("USD transaction CSV").setInputFiles({
      name,
      mimeType: "text/csv",
      buffer: Buffer.from(contents),
    })
    await page.getByRole("button", { name: "Preview import" }).click()
  }

  async function uploadPreview(
    page: Page,
    accountPath: string,
    contents: string,
    name?: string
  ) {
    await upload(page, accountPath, contents, name)
    await page.waitForURL(/\/imports\//)
    await page.getByRole("heading", { name: "Import preview" }).waitFor()
    return new URL(page.url()).pathname
  }

  async function transactionCount() {
    return Number(
      (await pool.query("select count(*) from financial_transaction")).rows[0]
        .count
    )
  }

  const originalPreview = await uploadPreview(owner, account, csv)
  await owner.getByText("Luna's proposed mapping").waitFor()
  await owner
    .getByText("2 ready to import · 3 excluded · Net total $1,494.75")
    .waitFor()
  await owner
    .getByText(/Invalid or ambiguous date/)
    .first()
    .waitFor()
  await owner.getByText(/Only USD rows/).waitFor()
  assert.equal(await transactionCount(), 0)
  async function requestAs(
    page: Page,
    path: string,
    fields?: Record<string, string>
  ) {
    const cookie = (await page.context().cookies())
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ")
    const headers = { origin, cookie }
    if (!fields) return fetch(origin + path, { headers, redirect: "manual" })
    const body = new FormData()
    for (const [key, value] of Object.entries(fields)) body.append(key, value)
    return fetch(origin + path, {
      method: "POST",
      body,
      headers,
      redirect: "manual",
    })
  }

  assert.equal((await requestAs(guest, originalPreview)).status, 404)
  assert.equal((await requestAs(guest, account)).status, 404)
  await owner.goto(
    `${secondAccount}/imports/${originalPreview.split("/").at(-1)}`
  )
  await owner.getByRole("heading", { name: "Import unavailable" }).waitFor()

  const confirmationPages = await Promise.all(
    Array.from({ length: 3 }, async () => {
      const page = await owner.context().newPage()
      await page.goto(originalPreview)
      return page
    })
  )
  function confirmFields(page: Page) {
    return page
      .getByRole("button", { name: "Confirm import" })
      .evaluate((button) =>
        Object.fromEntries(
          Array.from(new FormData(button.closest("form")!), ([key, value]) => [
            key,
            String(value),
          ])
        )
      )
  }
  const actionFields = await confirmFields(confirmationPages[0])
  assert.ok(Object.keys(actionFields).some((key) => key.startsWith("$ACTION_")))
  const forbidden = await requestAs(guest, originalPreview, actionFields)
  assert.equal(forbidden.status, 404)
  assert.equal(await transactionCount(), 0)

  async function confirm(page: Page) {
    await page.getByRole("button", { name: "Confirm import" }).click()
    await page.getByRole("heading", { name: "Confirmed import" }).waitFor()
  }

  await Promise.all(confirmationPages.slice(0, 2).map(confirm))
  await confirm(confirmationPages[2])
  assert.equal(await transactionCount(), 2)
  const stored = await pool.query(
    "select posted_date::text, amount_cents::int, description, category, source_id from financial_transaction order by source_row"
  )
  assert.deepEqual(stored.rows, [
    {
      posted_date: "2026-10-10",
      amount_cents: 150000,
      description: "Pay, Inc.",
      category: "Uncategorized",
      source_id: "SOURCE-001",
    },
    {
      posted_date: "2026-10-11",
      amount_cents: -525,
      description: 'Coffee "Shop"',
      category: "Uncategorized",
      source_id: "SOURCE-002",
    },
  ])
  assert.equal(
    (await pool.query("select preview from csv_import")).rows[0].preview,
    null
  )
  await owner.goto(account)
  const history = owner.getByRole("region", { name: "Import history" })
  const confirmedEntry = history.getByRole("link", {
    name: /synthetic\.csv Imported 2 transactions/,
  })
  await confirmedEntry.click()
  await owner.waitForURL(origin + originalPreview)
  await owner.getByRole("heading", { name: "Confirmed import" }).waitFor()
  assert.equal(
    await owner.getByText(/This CSV was already imported/).count(),
    0
  )
  await owner.getByRole("link", { name: "Back to Owned checking" }).click()
  await owner.waitForURL(origin + account)
  await confirmedEntry.waitFor()
  await upload(owner, account, csv, "same-bytes.csv")
  await owner.waitForURL(origin + originalPreview + "?notice=already-imported")
  await owner.getByRole("heading", { name: "Confirmed import" }).waitFor()
  await owner
    .getByRole("status")
    .getByText(/This CSV was already imported into this account/)
    .waitFor()
  assert.equal(await transactionCount(), 2)
  assert.equal(calls.length, 1)

  const separatePreview = await uploadPreview(owner, secondAccount, csv)
  assert.notEqual(separatePreview, originalPreview)
  await owner.getByRole("button", { name: "Cancel import" }).click()
  await owner.waitForURL(origin + secondAccount)
  await owner.goto(separatePreview)
  await owner.getByRole("heading", { name: "Import unavailable" }).waitFor()
  assert.equal(
    (
      await pool.query(
        "select count(*) from csv_import where confirmed_at is null"
      )
    ).rows[0].count,
    "0"
  )

  const expiry = await uploadPreview(
    owner,
    account,
    csv.replace("Coffee", "Tea"),
    "expires.csv"
  )
  const stalePage = await owner.context().newPage()
  await stalePage.goto(expiry)
  await pool.query(
    "update csv_import set expires_at = now() - interval '1 minute' where id = $1",
    [expiry.split("/").at(-1)]
  )
  await owner.reload()
  await owner.getByRole("heading", { name: "Import unavailable" }).waitFor()
  const expired = await requestAs(owner, expiry, await confirmFields(stalePage))
  assert.equal(expired.status, 404)
  assert.equal(await transactionCount(), 2)
  assert.equal((await fetch(origin + "/api/cron/csv-imports")).status, 401)
  assert.equal(
    (
      await pool.query(
        "select count(*) from csv_import where expires_at is not null"
      )
    ).rows[0].count,
    "1"
  )
  assert.equal(
    (
      await fetch(origin + "/api/cron/csv-imports", {
        headers: { authorization: `Bearer ${cronSecret}` },
      })
    ).status,
    204
  )
  assert.equal(
    (await pool.query("select count(*) from csv_import")).rows[0].count,
    "1"
  )

  await upload(
    owner,
    account,
    "2026-10-10,Jane Smith,1500,111122223333\n2026-10-11,Other Person,-5,222233334444"
  )
  await owner
    .getByRole("alert")
    .getByText(/Use a CSV with date/)
    .waitFor()
  await uploadPreview(owner, account, csv.replace("Coffee", "Cocoa"))
  assert.equal(calls.length, 5)
  for (const call of calls) {
    assert.equal(call.model, "gpt-6-luna")
    assert.equal(call.store, false)
    assert.doesNotMatch(
      JSON.stringify(call.input),
      /Jane Smith|Other Person|SOURCE-001|111122223333|1500\.00|2026-10-10|Coffee/
    )
  }

  await upload(owner, account, csv.replace("Coffee", "Soda"))
  await owner
    .getByRole("alert")
    .getByText(/You reached your daily AI limit/)
    .waitFor()
  assert.equal(calls.length, 5)

  failProvider = true
  await upload(guest, guestAccount, csv)
  await guest
    .getByRole("alert")
    .getByText(/Luna could not map/)
    .waitFor()
  assert.doesNotMatch(
    await guest.locator("body").innerText(),
    /private provider diagnostic|synthetic-csv-import-provider-key/
  )
  failProvider = false
  assert.equal(
    await guest
      .getByLabel("USD transaction CSV")
      .evaluate((input: HTMLInputElement) => input.files?.[0]?.name),
    "synthetic.csv"
  )
  await guest.getByRole("button", { name: "Preview import" }).click()
  await guest.waitForURL(/\/imports\//)
  await guest.getByRole("heading", { name: "Import preview" }).waitFor()
  assert.equal(calls.length, 7)

  await upload(guest, guestAccount, csv.replace("Coffee", "Water"))
  await guest
    .getByRole("alert")
    .getByText(/Buhj reached its daily AI limit/)
    .waitFor()
  assert.equal(calls.length, 7)
  assert.equal(await transactionCount(), 2)
  await pool.query("update ai_daily_usage set requests = 0")
  const split = [
    "Posted Date,Description,Debit,Credit,Transaction ID",
    "2026-10-17,Renamed pay,,1500.00,SOURCE-001",
    "2026-10-12,Refund,,12.00,REFUND-1",
    '10/11/2026,"Coffee ""Shop""",5.25,4.00,',
    '2026-10-11,"Coffee ""Shop""",-5.25,,',
    "2026-10-12,Refund repeated,0,12.00,REFUND-1",
    "2026-10-15,Groceries,20.00,0,",
  ].join("\n")
  const splitPreview = await uploadPreview(owner, account, split, "split.csv")
  await owner
    .getByText("Duplicate source ID. Excluded.", { exact: true })
    .nth(1)
    .waitFor()
  await owner.getByText(/Invalid or ambiguous amount Debit 5.25/).waitFor()
  const beforeCorrection = await owner.context().newPage()
  await beforeCorrection.goto(splitPreview)
  await owner.getByLabel("Date for row 3").fill("2026-10-11")
  await owner.getByLabel("Amount for row 3 (USD)").fill("coffee")
  await owner.getByRole("button", { name: "Save row 3" }).click()
  await owner
    .getByRole("alert")
    .filter({ hasText: "Enter a valid date" })
    .waitFor()
  await owner.getByLabel("Date for row 3").fill("2026-10-11")
  await owner.getByLabel("Amount for row 3 (USD)").fill("-5.25")
  await owner.getByRole("button", { name: "Save row 3" }).click()
  await owner.getByLabel("Possible duplicate on row 3").waitFor()

  await beforeCorrection
    .getByLabel("Possible duplicate on row 4")
    .selectOption("skip")
  await beforeCorrection.getByRole("button", { name: "Confirm import" }).click()
  await beforeCorrection
    .getByText("The preview changed. Review it again before confirming.")
    .waitFor()
  assert.equal(await transactionCount(), 2)
  await owner.reload()
  await owner.getByLabel("Possible duplicate on row 3").selectOption("keep")
  await owner.getByLabel("Possible duplicate on row 4").selectOption("skip")
  await confirm(owner)
  assert.equal(await transactionCount(), 5)
  const splitTransactions = await pool.query(
    "select posted_date::text, amount_cents::int, source_id from financial_transaction where import_id = $1 order by source_row",
    [splitPreview.split("/").at(-1)]
  )
  assert.deepEqual(splitTransactions.rows, [
    { posted_date: "2026-10-12", amount_cents: 1200, source_id: "REFUND-1" },
    { posted_date: "2026-10-11", amount_cents: -525, source_id: null },
    { posted_date: "2026-10-15", amount_cents: -2000, source_id: null },
  ])
  await owner.getByText("3 imported · 0 excluded · Net total -$13.25").waitFor()

  await uploadPreview(owner, secondAccount, split)
  assert.equal(
    await owner
      .getByText("Duplicate source ID. Excluded.", { exact: true })
      .count(),
    1
  )
  await confirm(owner)
  assert.equal(await transactionCount(), 9)

  const racing = await Promise.all(
    ["First", "Second"].map(async (description) => {
      const page = await owner.context().newPage()
      await uploadPreview(
        page,
        account,
        `Posted Date,Description,Debit,Credit,Transaction ID\n2026-10-18,${description},3.00,,RACE-1`
      )
      return page
    })
  )
  await Promise.all(
    racing.map((page) =>
      page.getByRole("button", { name: "Confirm import" }).click()
    )
  )
  for (const page of racing) {
    await page
      .getByRole("heading", { name: "Confirmed import" })
      .or(page.getByText("There are no new transactions selected to import."))
      .waitFor()
  }
  const confirmed = await Promise.all(
    racing.map((page) =>
      page.getByRole("heading", { name: "Confirmed import" }).count()
    )
  )
  assert.equal(
    confirmed.reduce((sum, count) => sum + count, 0),
    1
  )
  assert.equal(await transactionCount(), 10)
  assert.equal(
    (
      await pool.query(
        "select count(*) from financial_transaction where source_id = 'RACE-1'"
      )
    ).rows[0].count,
    "1"
  )
  const loser = racing[confirmed.indexOf(0)]
  await loser
    .getByText("Duplicate source ID. Excluded.", { exact: true })
    .waitFor()
  assert.equal(
    await loser.getByRole("button", { name: "Confirm import" }).isDisabled(),
    true
  )

  console.log(
    "CSV import passed in Chromium against isolated Postgres and a controlled GPT-6 Luna Responses endpoint."
  )
} finally {
  await browser.close()
  server.kill()
  provider.stop(true)
  await pool.end()
}
