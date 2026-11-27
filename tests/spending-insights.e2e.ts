import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
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
  "Plan your next grocery trip around the meals you already have ingredients for. List the staples you buy most often and compare unit prices on those items first. After a few shopping trips, check what you used and what you still have before buying more."
const calls: unknown[] = []
const pendingResponse = Promise.withResolvers<void>()
let responseMode: "failure" | "insight" | "mapping" = "failure"
let holdResponse = false

const browser = await chromium.launch()
const evidenceDir = process.env.INSIGHTS_SCREENSHOT_DIR
const desktopViewport = { width: 1280, height: 900 }
const mobileViewport = { width: 390, height: 844 }

async function screenshot(page: Page, state: string) {
  if (!evidenceDir) return
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: join(evidenceDir, state + ".png"),
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    style: "nextjs-portal { display: none !important; }",
  })
}

async function assertNoHorizontalOverflow(page: Page) {
  const { scroll, viewport } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  assert.ok(
    scroll <= viewport,
    `Page is ${scroll}px wide in a ${viewport}px viewport`
  )
}

async function tabTo(page: Page, selector: string) {
  await page.keyboard.press("Tab")
  // Chromium tabs through the individual segments of a native month input.
  for (
    let segment = 0;
    selector !== "#insight-month" && segment < 3;
    segment++
  ) {
    if (
      !(await page.evaluate(
        () => document.activeElement?.id === "insight-month"
      ))
    )
      break
    await page.keyboard.press("Tab")
  }
  const focus = await page.evaluate(
    (target) => ({
      matched: document.activeElement?.matches(target),
      element: document.activeElement?.outerHTML.split(">")[0],
    }),
    selector
  )
  assert.equal(
    focus.matched,
    true,
    `Expected keyboard focus on ${selector}, got ${focus.element}`
  )
}

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
    if (holdResponse) await pendingResponse.promise
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
    const context = await browser.newContext({
      baseURL: origin,
      viewport: desktopViewport,
      colorScheme: "light",
    })
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
      postedDate: "2026-10-19",
      description: "One dining purchase",
      amountCents: -2_599,
      category: "Dining",
    },
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
    groceries.map((row) => ({ ...row, amountCents: -2_000_000_000 }))
  )

  await owner.page.goto("/insights?month=2026-09")
  await owner.page.getByText("No saved Insights yet", { exact: true }).waitFor()
  await screenshot(owner.page, "desktop-light-empty")
  await tabTo(owner.page, ".workspace-skip-link")
  await owner.page.keyboard.press("Enter")
  await tabTo(owner.page, "#insight-month")
  await tabTo(owner.page, "main button[type=submit]")
  assert.equal(
    await owner.page
      .getByRole("button", { name: "Generate Insight" })
      .evaluate((button) => getComputedStyle(button).outlineStyle),
    "solid"
  )
  await owner.page.keyboard.press("Enter")
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "Too little spending evidence" })
    .waitFor()
  assert.equal(calls.length, 0)
  await screenshot(owner.page, "desktop-light-insufficient")

  const monthInput = owner.page.getByLabel("Month")
  await monthInput.fill("2026-10")
  await owner.page
    .locator("main")
    .getByRole("alert")
    .waitFor({ state: "hidden" })
  await owner.page.getByRole("button", { name: "Generate Insight" }).click()
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "could not generate an Insight" })
    .waitFor()
  assert.equal(calls.length, 1)
  assert.equal(await monthInput.inputValue(), "2026-10")
  await screenshot(owner.page, "desktop-light-provider-error")
  assert.ok(!(await owner.page.locator("body").innerText()).includes(fakeKey))
  assert.ok(
    !(await owner.page.locator("body").innerText()).includes(
      "private provider diagnostic"
    )
  )

  responseMode = "insight"
  holdResponse = true
  await owner.page.getByRole("button", { name: "Generate Insight" }).click()
  await owner.page
    .getByRole("status")
    .filter({ hasText: "Generating Insight…" })
    .waitFor()
  assert.ok(
    await owner.page
      .getByRole("button", { name: "Generate Insight" })
      .isDisabled()
  )
  assert.equal(await monthInput.getAttribute("readonly"), "")
  await owner.page
    .locator("main")
    .getByRole("alert")
    .waitFor({ state: "hidden" })
  await screenshot(owner.page, "desktop-light-pending")
  holdResponse = false
  pendingResponse.resolve()
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
  const octoberHeading = owner.page.getByRole("heading", {
    name: "October 2026 Insight",
    exact: true,
  })
  await octoberHeading.waitFor()
  await owner.page.getByText(/Oct 1.*31, 2026/).waitFor()
  await owner.page
    .getByText(/5 confirmed transactions across all accounts/)
    .waitFor()
  await owner.page.getByText("$270.00", { exact: true }).waitFor()
  await owner.page.getByText("$135.99", { exact: true }).waitFor()
  await owner.page.getByText("$134.01", { exact: true }).waitFor()
  const suggestions = owner.page.getByRole("region", { name: "Suggestions" })
  const grocerySuggestion = suggestions
    .getByRole("listitem")
    .filter({ hasText: "Groceries" })
  await grocerySuggestion.getByText("$90.00", { exact: true }).waitFor()
  await grocerySuggestion
    .getByText("2 purchases on 2 dates", { exact: true })
    .waitFor()
  await grocerySuggestion.getByText(advice, { exact: true }).waitFor()
  const other = owner.page.getByRole("region", {
    name: "Other category evidence",
  })
  await other.getByText("Dining", { exact: true }).waitFor()
  await other.getByText(/\$25\.99/).waitFor()
  assert.equal((await guest.page.goto(insightPath))?.status(), 404)
  await owner.page.getByText("Draft", { exact: true }).waitFor()
  await screenshot(owner.page, "desktop-light-draft")

  const indexPage = await owner.page.context().newPage()
  await indexPage.goto("/insights")
  await indexPage.getByText("No saved Insights yet", { exact: true }).waitFor()
  await indexPage.close()
  await owner.page.goto(insightPath)
  await octoberHeading.waitFor()
  await tabTo(owner.page, ".workspace-skip-link")
  await owner.page.keyboard.press("Enter")
  await tabTo(owner.page, 'main a[href="/insights?month=2026-10"]')
  await tabTo(owner.page, "main button[type=submit]")
  await owner.page.keyboard.press("Enter")
  await owner.page.getByText("Saved", { exact: true }).waitFor()
  assert.equal(
    await owner.page.getByRole("button", { name: "Save Insight" }).count(),
    0
  )
  await screenshot(owner.page, "desktop-light-saved")
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
    .getByRole("link", { name: "Outflows transactions −$635.99", exact: true })
    .waitFor()
  assert.equal(calls.length, 3)

  await owner.page.goto("/insights")
  const octoberLink = owner.page.getByRole("link", {
    name: /October 2026 Saved/,
  })
  await octoberLink.waitFor()
  await screenshot(owner.page, "desktop-light-list")
  await owner.page.getByRole("button", { name: "Appearance" }).click()
  await owner.page.getByRole("menuitemradio", { name: "Dark" }).click()
  await owner.page.locator("html.dark").waitFor()
  await screenshot(owner.page, "desktop-dark-list")
  await owner.page.getByRole("button", { name: "Generate Insight" }).focus()
  await tabTo(owner.page, `main a[href="${insightPath}"]`)
  await owner.page.keyboard.press("Enter")
  await octoberHeading.waitFor()
  await owner.page.getByText("Saved", { exact: true }).waitFor()
  assert.equal(await owner.page.locator("main").innerText(), original)
  assert.equal(calls.length, 3)
  await assertNoHorizontalOverflow(owner.page)
  await screenshot(owner.page, "desktop-dark-saved")
  await owner.page.setViewportSize(mobileViewport)
  await assertNoHorizontalOverflow(owner.page)
  await screenshot(owner.page, "mobile-dark-saved")
  await owner.page.setViewportSize(desktopViewport)
  await owner.page.getByRole("button", { name: "Appearance" }).click()
  await owner.page.getByRole("menuitemradio", { name: "Light" }).click()
  await owner.page.locator("html.light").waitFor()
  await generate(owner.page)
  await owner.page
    .getByRole("alert")
    .filter({ hasText: "You reached your daily AI limit" })
    .waitFor()
  assert.equal(calls.length, 3)
  await screenshot(owner.page, "desktop-light-limit")

  responseMode = "insight"
  await generate(guest.page)
  await guest.page.waitForURL(/\/insights\/[0-9a-f-]+$/)
  const guestPath = new URL(guest.page.url()).pathname
  await guest.page
    .getByText("$40,000,000.00", { exact: true })
    .first()
    .waitFor()
  await guest.page.setViewportSize(mobileViewport)
  await assertNoHorizontalOverflow(guest.page)
  await screenshot(guest.page, "mobile-light-draft")
  await guest.page.emulateMedia({ colorScheme: "dark" })
  await guest.page.locator("html.dark").waitFor()
  await assertNoHorizontalOverflow(guest.page)
  await screenshot(guest.page, "mobile-dark-draft")
  await guest.page.getByRole("link", { name: "Spending Insights" }).click()
  await guest.page.waitForURL("**/insights?month=2026-10")
  assert.equal(await guest.page.getByLabel("Month").inputValue(), "2026-10")
  await assertNoHorizontalOverflow(guest.page)
  await screenshot(guest.page, "mobile-dark-empty")
  await guest.page.goto(guestPath)
  await guest.page.getByText("Draft", { exact: true }).waitFor()
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
  pendingResponse.resolve()
  await browser.close()
  server.kill()
  provider.stop(true)
  await pool.end()
}
