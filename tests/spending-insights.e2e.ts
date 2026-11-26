import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import { eq } from "drizzle-orm"
import { chromium, type Page } from "playwright"

import { createSignupInvite } from "../lib/auth/signup-invites"
import { db, pool } from "../lib/db"
import {
  csvImport,
  financialAccount,
  financialTransaction,
  savedResult,
} from "../lib/db/schema"

const database = new URL(process.env.DATABASE_URL ?? "")
assert.equal(database.hostname, "127.0.0.1", "Use a disposable local database")
assert.match(database.pathname, /_test$/, "Use a fresh database named *_test")

const origin = "http://127.0.0.1:34156"
const fakeKey = "synthetic-insight-provider-key"
const cronSecret = randomUUID()
const advice =
  "Check which grocery purchases you could replace with lower-cost staples."
const calls: unknown[] = []
let responseMode: "failure" | "insight" | "mapping" = "failure"

const browser = await chromium.launch()
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    assert.equal(new URL(request.url).pathname, "/v1/responses")
    assert.equal(request.headers.get("authorization"), "Bearer " + fakeKey)
    const body = await request.json()
    assert.equal(body.store, false)
    assert.equal(
      body.model,
      responseMode === "mapping" ? "gpt-6-luna" : "gpt-6.1-terra"
    )
    assert.equal(body.reasoning?.effort, "none")
    assert.equal(body.text?.format?.strict, true)
    const prompt = body.input.find(
      (message: { role: string }) => message.role === "user"
    )
    calls.push(prompt)
    if (responseMode === "failure") {
      return new Response("private provider diagnostic", { status: 502 })
    }
    const output =
      responseMode === "insight"
        ? { suggestions: [{ category: "Groceries", advice }] }
        : {
            mapping: {
              date: 0,
              description: 1,
              amount: 2,
              sign: "positive-inflow",
              sourceId: null,
            },
          }
    return Response.json({
      id: "resp_test",
      model: body.model,
      output: [
        {
          id: "msg_test",
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(output),
              annotations: [],
            },
          ],
        },
      ],
    })
  },
})
const serverEnv = { ...process.env }
delete serverEnv.OPENAI_INSIGHT_MODEL
const server = Bun.spawn(
  [
    "node",
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "34156",
  ],
  {
    env: {
      ...serverEnv,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      OPENAI_API_KEY: fakeKey,
      OPENAI_BASE_URL: `http://127.0.0.1:${provider.port}/v1`,
      AI_DAILY_USER_LIMIT: "3",
      AI_DAILY_APP_LIMIT: "4",
      CRON_SECRET: cronSecret,
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
    context.setDefaultTimeout(12_000)
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
    const [account] = await db
      .insert(financialAccount)
      .values({
        userId: user.id,
        name: name + " account",
        institution: "Test bank",
      })
      .returning()
    return { page: await context.newPage(), account: account.id }
  }

  async function seed(
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
        filename: "seed.csv",
        fingerprint: randomUUID(),
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
  }

  async function generate(page: Page, month = "2026-10") {
    await page.goto("/insights?month=" + month)
    await page.getByRole("button", { name: "Generate Insight" }).click()
  }

  const groceries = [
    {
      postedDate: "2026-10-03",
      description: "Private merchant A",
      amountCents: -6_000,
      category: "Groceries",
    },
    {
      postedDate: "2026-10-10",
      description: "Private merchant B",
      amountCents: -5_000,
      category: "Groceries",
    },
  ]
  const owner = await signUp("Owner")
  const guest = await signUp("Guest")
  await seed(owner.account, [
    ...groceries,
    {
      postedDate: "2026-10-12",
      description: "Refund",
      amountCents: 2_000,
      category: "Groceries",
      spendingKind: "refund",
    },
    {
      postedDate: "2026-10-14",
      description: "Transfer",
      amountCents: -50_000,
      category: "Groceries",
      spendingKind: "transfer",
    },
    { postedDate: "2026-10-18", description: "Deposit", amountCents: 25_000 },
    {
      postedDate: "2026-09-12",
      description: "Single purchase",
      amountCents: -1_000,
      category: "Groceries",
    },
  ])
  await seed(
    owner.account,
    [
      {
        postedDate: "2026-10-22",
        description: "Preview only",
        amountCents: -10_000,
        category: "Groceries",
      },
      {
        postedDate: "2026-09-14",
        description: "Preview only",
        amountCents: -10_000,
        category: "Groceries",
      },
    ],
    false
  )
  await seed(
    guest.account,
    groceries.map((row) => ({ ...row, amountCents: -20_000 }))
  )

  await generate(owner.page, "2026-09")
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "too little spending evidence" })
    .waitFor()
  assert.equal(calls.length, 0)

  await generate(owner.page)
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "could not generate an Insight" })
    .waitFor()
  assert.equal(calls.length, 1)
  assert.ok(!(await owner.page.locator("body").innerText()).includes(fakeKey))
  assert.ok(
    !(await owner.page.locator("body").innerText()).includes(
      "private provider diagnostic"
    )
  )

  responseMode = "insight"
  await generate(owner.page)
  await owner.page.waitForURL(/\/insights\/[0-9a-f-]+$/)
  const insightPath = new URL(owner.page.url()).pathname
  const id = insightPath.split("/").at(-1)!
  const prompt = JSON.stringify(calls[1])
  assert.match(prompt, /Groceries/)
  assert.match(prompt, /\$90\.00/)
  assert.doesNotMatch(
    prompt,
    /2026-10|Private merchant|Owner account|270\.00|50,?000/
  )
  await owner.page.getByText("Source period 2026-10-01 to 2026-10-31").waitFor()
  await owner.page
    .getByText(
      "4 confirmed transactions from 2026-10-03 to 2026-10-18, excluding transfers."
    )
    .waitFor()
  await owner.page.getByText("$270.00", { exact: true }).waitFor()
  await owner.page.getByText("$110.00", { exact: true }).waitFor()
  await owner.page.getByText("$160.00", { exact: true }).waitFor()
  await owner.page
    .getByText("$90.00 net spending. 2 purchases on 2 dates.")
    .waitFor()
  await owner.page.getByText(advice, { exact: true }).waitFor()
  assert.equal((await guest.page.goto(insightPath))?.status(), 404)

  const draft = await owner.page.context().newPage()
  await draft.goto("/insights")
  await draft.getByText("No saved Insights yet.").waitFor()
  await owner.page.getByRole("button", { name: "Save Insight" }).click()
  await owner.page
    .getByRole("heading", { name: "Saved Insight", exact: true })
    .waitFor()
  const original = await owner.page.locator("main").innerText()
  const [saved] = await db
    .select()
    .from(savedResult)
    .where(eq(savedResult.id, id))
  assert.ok(saved.savedAt)
  assert.equal((await guest.page.goto(insightPath))?.status(), 404)

  responseMode = "mapping"
  await owner.page.goto("/financial-accounts/" + owner.account)
  await owner.page.getByLabel("USD transaction CSV").setInputFiles({
    name: "new-spending.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Date,Description,Amount\n2026-10-24,New groceries,-500.00\n"
    ),
  })
  await owner.page.getByRole("button", { name: "Preview import" }).click()
  await owner.page.waitForURL(/\/imports\//)
  await owner.page.getByRole("button", { name: "Confirm import" }).click()
  await owner.page.getByRole("heading", { name: "Confirmed import" }).waitFor()
  await owner.page.goto("/spending?month=2026-10")
  await owner.page
    .getByLabel("Outflows", { exact: true })
    .getByText("$610.00")
    .waitFor()
  assert.equal(calls.length, 3)

  await owner.page.goto("/insights")
  await owner.page
    .getByRole("link", { name: "2026-10-01 to 2026-10-31" })
    .click()
  await owner.page
    .getByRole("heading", { name: "Saved Insight", exact: true })
    .waitFor()
  assert.equal(await owner.page.locator("main").innerText(), original)
  assert.equal(calls.length, 3)
  await generate(owner.page)
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "You reached your daily AI limit" })
    .waitFor()
  assert.equal(calls.length, 3)

  responseMode = "insight"
  await generate(guest.page)
  await guest.page.waitForURL(/\/insights\/[0-9a-f-]+$/)
  const guestPath = new URL(guest.page.url()).pathname
  await guest.page
    .getByText("$400.00 net spending. 2 purchases on 2 dates.")
    .waitFor()
  await guest.page
    .locator('input[name="id"]')
    .evaluate((input, otherId) => input.setAttribute("value", otherId), id)
  await guest.page.getByRole("button", { name: "Save Insight" }).click()
  await guest.page.getByRole("heading", { name: "404" }).waitFor()
  const [untouched] = await db
    .select()
    .from(savedResult)
    .where(eq(savedResult.id, id))
  assert.deepEqual(untouched, saved)

  await generate(guest.page)
  await guest.page
    .getByRole("alert")
    .filter({ hasText: "Buhj reached its daily AI limit" })
    .waitFor()
  assert.equal(calls.length, 4)

  const guestId = guestPath.split("/").at(-1)!
  await db
    .update(savedResult)
    .set({ createdAt: new Date(0) })
    .where(eq(savedResult.id, guestId))
  assert.equal((await guest.page.goto(guestPath))?.status(), 404)
  assert.equal(
    (
      await fetch(origin + "/api/cron/csv-imports", {
        headers: { authorization: "Bearer " + cronSecret },
      })
    ).status,
    204
  )
  assert.equal(
    (await db.select().from(savedResult).where(eq(savedResult.id, guestId)))
      .length,
    0
  )
  assert.equal(
    (await db.select().from(savedResult).where(eq(savedResult.id, id))).length,
    1
  )

  console.info(
    "Spending Insights passed with confirmed evidence, immutable saves, private drafts, and shared AI limits."
  )
} finally {
  await browser.close()
  server.kill()
  provider.stop(true)
  await pool.end()
}
