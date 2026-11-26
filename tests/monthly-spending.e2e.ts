import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import { chromium, type Page } from "playwright"

import { createSignupInvite } from "../lib/auth/signup-invites"
import { db, pool } from "../lib/db"
import {
  csvImport,
  financialAccount,
  financialTransaction,
} from "../lib/db/schema"

const database = new URL(process.env.DATABASE_URL ?? "")
assert.equal(database.hostname, "127.0.0.1", "Use a disposable local database")
assert.match(
  database.pathname,
  /_test$/,
  "Use a disposable database named *_test"
)

const origin = "http://127.0.0.1:34154"
const browser = await chromium.launch()
const server = Bun.spawn(
  [
    "node",
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "34154",
  ],
  {
    env: {
      ...process.env,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
    },
    stdout: "inherit",
    stderr: "inherit",
  }
)

try {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(origin, { redirect: "manual" }).catch(
      () => null
    )
    if (response?.status === 307) break
    assert.ok(attempt < 120, "Next.js did not start")
    await setTimeout(250)
  }

  async function signUp(name: string) {
    const context = await browser.newContext({ baseURL: origin })
    const response = await fetch(origin + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email: name + "-" + randomUUID() + "@example.test",
        password: "disposable-test-password",
        inviteToken: await createSignupInvite(new Date(Date.now() + 600_000)),
      }),
    })
    assert.equal(
      response.status,
      200,
      response.ok ? undefined : await response.text()
    )
    await context.addCookies(
      response.headers.getSetCookie().map((cookie) => {
        const [name, ...value] = cookie.split(";")[0].split("=")
        return { name, value: value.join("="), url: origin }
      })
    )
    const { user } = await response.json()
    return { page: await context.newPage(), id: String(user.id) }
  }

  async function addAccount(userId: string, name: string) {
    const [account] = await db
      .insert(financialAccount)
      .values({ userId, name, institution: "Test bank" })
      .returning()
    return account.id
  }

  async function addImport(
    accountId: string,
    rows: Omit<
      typeof financialTransaction.$inferInsert,
      "importId" | "sourceRow"
    >[],
    confirmed = true
  ) {
    const [record] = await db
      .insert(csvImport)
      .values({
        accountId,
        fingerprint: randomUUID(),
        filename: "statement.csv",
        ...(confirmed
          ? { confirmedAt: new Date(), transactionCount: rows.length }
          : {
              expiresAt: new Date(Date.now() + 600_000),
              preview: {
                columns: {
                  date: "Date",
                  description: "Description",
                  amount: "Amount",
                  sign: "positive-inflow",
                },
                rows: [],
              },
            }),
      })
      .returning()
    await db.insert(financialTransaction).values(
      rows.map((row, index) => ({
        ...row,
        importId: record.id,
        sourceRow: index + 1,
      }))
    )
    return record.id
  }

  const owner = await signUp("Owner")
  const guest = await signUp("Guest")
  const checking = await addAccount(owner.id, "Owner checking")
  const card = await addAccount(owner.id, "Owner card")
  const guestAccount = await addAccount(guest.id, "Guest account")
  const ownerImport = await addImport(checking, [
    { postedDate: "2026-10-01", description: "Paycheck", amountCents: 150_013 },
    {
      postedDate: "2026-10-15",
      description: "Card payment",
      amountCents: -10_001,
    },
    {
      postedDate: "2026-11-01",
      description: "Next month",
      amountCents: -45_000,
    },
  ])
  await addImport(card, [
    {
      postedDate: "2026-10-03",
      description: "Market",
      amountCents: -6_003,
      category: "Unknown label",
    },
    {
      postedDate: "2026-10-05",
      description: "Market refund",
      amountCents: 1_019,
    },
    {
      postedDate: "2026-10-16",
      description: "Card payment credit",
      amountCents: 10_001,
    },
    { postedDate: "2026-10-31", description: "Bus fare", amountCents: -217 },
  ])
  await addImport(
    checking,
    [
      {
        postedDate: "2026-10-15",
        description: "Unconfirmed item",
        amountCents: -99_999,
      },
    ],
    false
  )
  await addImport(guestAccount, [
    {
      postedDate: "2026-10-15",
      description: "Guest purchase",
      amountCents: -888,
    },
  ])

  const spending = "/spending?month=2026-10"
  const anonymous = await browser.newPage({ baseURL: origin })
  await anonymous.goto(spending)
  assert.equal(new URL(anonymous.url()).pathname, "/sign-in")
  await owner.page.goto("/")
  await owner.page.getByRole("link", { name: "Monthly spending" }).click()
  await owner.page.getByLabel("Month", { exact: true }).fill("2026-10")
  await owner.page.getByRole("button", { name: "Show month" }).click()
  await owner.page.waitForURL(/month=2026-10/)

  function row(page: Page, description: string) {
    return page.getByRole("row").filter({
      has: page.getByRole("cell", { name: description, exact: true }),
    })
  }

  async function totals(
    page: Page,
    inflows: string,
    outflows: string,
    net: string
  ) {
    for (const [label, amount] of [
      ["Inflows", inflows],
      ["Outflows", outflows],
      ["Net cash flow", net],
    ]) {
      await page
        .locator(`[aria-label="${label}"]`)
        .getByText(amount, { exact: true })
        .waitFor()
    }
  }

  async function correct(description: string, category: string, kind: string) {
    const transaction = row(owner.page, description)
    await transaction.getByLabel("Category").selectOption(category)
    await transaction.getByLabel("Type").selectOption(kind)
    const response = owner.page.waitForResponse(
      (result) =>
        result.request().method() === "POST" &&
        new URL(result.url()).pathname === "/spending"
    )
    await transaction.getByRole("button", { name: "Save" }).click()
    assert.equal((await response).status(), 200)
  }

  await totals(owner.page, "$1,610.33", "$162.21", "$1,448.12")
  await row(owner.page, "Uncategorized")
    .getByText("$162.21", { exact: true })
    .waitFor()
  assert.equal(await row(owner.page, "Unconfirmed item").count(), 0)
  assert.equal(await row(owner.page, "Guest purchase").count(), 0)
  assert.equal(await row(owner.page, "Next month").count(), 0)

  await correct("Card payment", "Uncategorized", "transfer")
  await correct("Card payment credit", "Uncategorized", "transfer")
  await totals(owner.page, "$1,510.32", "$62.20", "$1,448.12")
  await correct("Market", "Groceries", "activity")
  await correct("Market refund", "Groceries", "refund")
  await row(owner.page, "Groceries")
    .getByText("$49.84", { exact: true })
    .waitFor()
  await row(owner.page, "Uncategorized")
    .getByText("$2.17", { exact: true })
    .waitFor()
  await totals(owner.page, "$1,510.32", "$62.20", "$1,448.12")

  await owner.page.getByLabel("Financial account").selectOption(card)
  await owner.page.getByRole("button", { name: "Show month" }).click()
  await owner.page.waitForURL(new RegExp("account=" + card))
  await totals(owner.page, "$10.19", "$62.20", "-$52.01")
  await owner.page.getByRole("link", { name: "Groceries" }).click()
  await owner.page
    .getByRole("heading", { name: "Groceries transactions" })
    .waitFor()
  assert.equal(new URL(owner.page.url()).searchParams.get("account"), card)
  assert.equal(await row(owner.page, "Market").count(), 1)
  assert.equal(await row(owner.page, "Market refund").count(), 1)
  assert.equal(await row(owner.page, "Bus fare").count(), 0)
  assert.equal(await row(owner.page, "Paycheck").count(), 0)

  await owner.page.getByRole("link", { name: "Transfers", exact: true }).click()
  await owner.page
    .getByRole("heading", { name: "Internal transfers" })
    .waitFor()
  await row(owner.page, "Card payment credit").waitFor()
  assert.equal(await row(owner.page, "Card payment").count(), 0)
  await correct("Card payment credit", "Uncategorized", "activity")
  await totals(owner.page, "$110.20", "$62.20", "$48.00")
  await owner.page
    .getByText("No confirmed transactions in this view.")
    .waitFor()
  await owner.page.reload()
  await totals(owner.page, "$110.20", "$62.20", "$48.00")

  assert.equal(
    (await guest.page.goto(spending + "&account=" + checking))?.status(),
    404
  )
  await guest.page.goto(spending)
  await totals(guest.page, "$0.00", "$8.88", "-$8.88")
  assert.equal(await row(guest.page, "Paycheck").count(), 0)
  const guestRow = row(guest.page, "Guest purchase")
  await guestRow.getByLabel("Type").selectOption("transfer")
  await guestRow
    .locator('input[name="importId"]')
    .evaluate((input: HTMLInputElement, id) => {
      input.value = id
    }, ownerImport)
  await guestRow.getByRole("button", { name: "Save" }).click()
  await guestRow
    .getByRole("alert")
    .getByText("This transaction could not be updated.")
    .waitFor()
  await owner.page.goto(spending)
  await totals(owner.page, "$1,610.33", "$62.20", "$1,548.13")
  console.log(
    "Monthly spending fixture, corrections, drilldown, and two-user isolation passed."
  )
} finally {
  await browser.close()
  server.kill()
  await server.exited
  await pool.end()
}
