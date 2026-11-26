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
  incomeProfile,
  savedResult,
} from "../lib/db/schema"

const database = new URL(process.env.DATABASE_URL ?? "")
assert.equal(database.hostname, "127.0.0.1", "Use a disposable local database")
assert.match(database.pathname, /_test$/, "Use a fresh database named *_test")

const origin = "http://127.0.0.1:34157"
const fakeKey = "synthetic-projection-provider-key"
const advice =
  "Review how much room you have before committing to an automatic transfer."
const calls: unknown[] = []
let responseMode: "failure" | "invalid-citation" | "projection" = "failure"

const browser = await chromium.launch()
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    assert.equal(new URL(request.url).pathname, "/v1/responses")
    assert.equal(request.headers.get("authorization"), "Bearer " + fakeKey)
    const body = await request.json()
    assert.equal(body.store, false)
    assert.equal(body.model, "gpt-6.1-terra")
    assert.equal(body.reasoning?.effort, "none")
    assert.equal(body.text?.format?.strict, true)
    const prompt = body.input.find(
      (message: { role: string }) => message.role === "user"
    )
    calls.push(prompt)
    if (responseMode === "failure") {
      return new Response("private provider diagnostic", { status: 502 })
    }
    const output = {
      advice: [
        {
          evidence:
            responseMode === "invalid-citation"
              ? "Unknown evidence"
              : "Estimated monthly surplus",
          advice,
        },
      ],
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
    "34157",
  ],
  {
    env: {
      ...serverEnv,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      OPENAI_API_KEY: fakeKey,
      OPENAI_BASE_URL: `http://127.0.0.1:${provider.port}/v1`,
      AI_DAILY_USER_LIMIT: "5",
      AI_DAILY_APP_LIMIT: "6",
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
    await db.insert(incomeProfile).values({
      userId: user.id,
      jobTitle: "Private sample job title",
      grossAnnualCents: 8_000_000,
      takeHomePerPaycheckCents: 200_000,
      paySchedule: "monthly",
    })
    return {
      page: await context.newPage(),
      account: account.id,
      userId: user.id,
    }
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

  const owner = await signUp("ProjectionOwner")
  const guest = await signUp("ProjectionGuest")
  const groceries = {
    postedDate: "2026-10-03",
    description: "Private merchant",
    amountCents: -10_000,
    category: "Groceries",
  }
  const deposit = {
    description: "Private payroll",
    amountCents: 75_000,
    spendingKind: "regular_pay" as const,
  }
  await seed(owner.account, [
    groceries,
    {
      ...groceries,
      postedDate: "2026-10-10",
      amountCents: 2_000,
      spendingKind: "refund",
    },
    {
      ...groceries,
      postedDate: "2026-10-15",
      amountCents: -40_000,
      spendingKind: "transfer",
    },
    ...["2026-09-04", "2026-09-11", "2026-09-18"].map((postedDate) => ({
      ...deposit,
      postedDate,
    })),
  ])
  await seed(owner.account, [{ ...groceries, amountCents: -55_000 }], false)
  await seed(guest.account, [
    { ...groceries, amountCents: -90_000 },
    { ...deposit, postedDate: "2026-09-25" },
  ])

  async function generate(page: Page) {
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === "/projections"
      ),
      page.getByRole("button", { name: "Generate Projection" }).click(),
    ])
  }
  const alert = (page: Page, hasText: string) =>
    page.getByRole("alert").filter({ hasText }).waitFor()
  const newProjection = (page: Page, month = "2026-10") =>
    page.goto("/projections?month=" + month)
  async function spend(page: Page) {
    await page.getByLabel("Spending category").selectOption("Groceries")
    await page.getByLabel("Monthly reduction (USD)").fill("30")
  }
  async function target(page: Page, date?: string) {
    await page.getByLabel("Scenario").selectOption("target")
    await page.getByLabel("Starting amount (USD)").fill("125")
    await page.getByLabel("Savings target (USD)").fill("425")
    if (date) await page.getByLabel("Target date (optional)").fill(date)
  }

  await newProjection(guest.page, "2026-09")
  assert.ok(
    await guest.page.getByRole("option", { name: "Observed pay" }).isDisabled()
  )
  await target(guest.page)
  await generate(guest.page)
  await alert(guest.page, "Choose a month with recorded purchases")
  assert.equal(calls.length, 0)

  await newProjection(owner.page)
  assert.equal(
    await owner.page.getByLabel("Pay baseline").inputValue(),
    "reported"
  )
  await spend(owner.page)
  await generate(owner.page)
  await alert(owner.page, "could not generate a Projection")
  assert.equal(
    await owner.page.getByLabel("Monthly reduction (USD)").inputValue(),
    "30"
  )
  assert.doesNotMatch(
    await owner.page.locator("body").innerText(),
    /synthetic-projection-provider-key|private provider diagnostic/
  )
  assert.equal(calls.length, 1)

  assert.equal(
    await owner.page.getByLabel("Spending category").inputValue(),
    "Groceries"
  )
  responseMode = "invalid-citation"
  await generate(owner.page)
  await alert(owner.page, "could not generate a Projection")
  assert.equal(calls.length, 2)
  assert.equal((await db.select().from(savedResult)).length, 0)

  responseMode = "projection"
  await generate(owner.page)
  await owner.page.waitForURL(/\/projections\/[0-9a-f-]+$/)
  await owner.page.getByText("Source period 2026-10-01 to 2026-10-31").waitFor()
  await owner.page.getByText("$2,000.00 average per month").waitFor()
  await owner.page.getByText("$80.00 net spending.", { exact: false }).waitFor()
  await owner.page
    .getByText(
      "$30.00 less per month leaves $50.00 in monthly spending and $1,950.00 in estimated monthly surplus."
    )
    .waitFor()
  await owner.page.getByText(advice, { exact: true }).waitFor()
  assert.doesNotMatch(
    JSON.stringify(calls[2]),
    /2026-|Private|ProjectionOwner|90[0,]00/
  )
  const path = new URL(owner.page.url()).pathname
  const id = path.split("/").at(-1)!
  assert.equal((await guest.page.goto(path))?.status(), 404)
  assert.equal(
    (
      await owner.page.request.get(
        origin + path.replace("projections", "insights")
      )
    ).status(),
    404
  )

  let rejectedSave: number | undefined
  await owner.page.route("**/projections/" + id, async (route) => {
    const request = route.request()
    const headers = request.headers()
    const body = request.postDataBuffer()
    if (request.method() === "POST" && body && headers["next-action"]) {
      const response = await guest.page.request.post(origin + path, {
        headers: {
          origin,
          "content-type": headers["content-type"],
          "next-action": headers["next-action"],
        },
        data: body,
        maxRedirects: 0,
      })
      rejectedSave = response.status()
      const [draft] = await db
        .select()
        .from(savedResult)
        .where(eq(savedResult.id, id))
      assert.equal(draft.savedAt, null)
    }
    await route.continue()
  })
  await owner.page.getByRole("button", { name: "Save Projection" }).click()
  await owner.page.getByRole("heading", { name: "Saved Projection" }).waitFor()
  assert.equal(rejectedSave, 404)
  assert.equal((await guest.page.goto(path))?.status(), 404)
  const original = await owner.page.locator("main").innerText()

  await db
    .update(incomeProfile)
    .set({ takeHomePerPaycheckCents: 300_000 })
    .where(eq(incomeProfile.userId, owner.userId))
  await seed(owner.account, [
    { ...groceries, postedDate: "2026-10-24", amountCents: -20_000 },
  ])
  await newProjection(owner.page)
  await owner.page
    .getByRole("link", { name: /Spending change.*Reported pay/ })
    .click()
  await owner.page.getByRole("heading", { name: "Saved Projection" }).waitFor()
  assert.equal(await owner.page.locator("main").innerText(), original)
  await owner.page.reload()
  assert.equal(await owner.page.locator("main").innerText(), original)

  await newProjection(owner.page)
  await owner.page.getByLabel("Pay baseline").selectOption("observed")
  const targetDate = new Date(Date.now() + 21 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  await target(owner.page, targetDate)
  await generate(owner.page)
  await owner.page.waitForURL(/\/projections\/[0-9a-f-]+$/)
  await owner.page
    .getByText("Observed pay · $750.00 per paycheck · Weekly")
    .waitFor()
  await owner.page
    .getByText("Based on 3 confirmed deposits through 2026-09-18.")
    .waitFor()
  await owner.page.getByText("$3,250.00 average per month").waitFor()
  await owner.page.getByText("$300.00", { exact: true }).waitFor()
  await owner.page
    .getByText("$100.00 per week over 21 days, rounded up to the cent.")
    .waitFor()
  await owner.page.getByRole("button", { name: "Save Projection" }).click()
  await owner.page.getByRole("heading", { name: "Saved Projection" }).waitFor()

  await newProjection(owner.page)
  await target(owner.page)
  await generate(owner.page)
  await owner.page.waitForURL(/\/projections\/[0-9a-f-]+$/)
  await owner.page.getByText("$3,000.00 average per month").waitFor()
  await owner.page.getByText("with no target date", { exact: false }).waitFor()
  assert.equal(await owner.page.getByText("Required weekly savings").count(), 0)

  await newProjection(owner.page)
  await target(owner.page)
  await generate(owner.page)
  await alert(owner.page, "You reached your daily AI limit")
  assert.equal(calls.length, 5)

  await newProjection(guest.page)
  await target(guest.page)
  await generate(guest.page)
  await guest.page.waitForURL(/\/projections\/[0-9a-f-]+$/)
  await newProjection(guest.page)
  await target(guest.page)
  await generate(guest.page)
  await alert(guest.page, "Buhj reached its daily AI limit")
  assert.equal(calls.length, 6)

  console.log(
    "Projection E2E passed: baseline availability, arithmetic, citations, snapshots, ownership, and quotas."
  )
} finally {
  server.kill()
  await server.exited
  provider.stop()
  await browser.close()
  await pool.end()
}
