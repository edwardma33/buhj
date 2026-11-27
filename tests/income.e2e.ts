import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout } from "node:timers/promises"

import { chromium, type Locator, type Page } from "playwright"

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

const captures = process.env.INCOME_SCREENSHOT_DIR
if (captures) await mkdir(captures, { recursive: true })

const origin = "http://127.0.0.1:35467"
const browser = await chromium.launch()
const server = Bun.spawn(
  [
    "node",
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "35467",
  ],
  {
    env: {
      ...process.env,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      AI_DAILY_USER_LIMIT: "0",
      AI_DAILY_APP_LIMIT: "0",
    },
    stdout: "inherit",
    stderr: "inherit",
  }
)

async function focused(field: Locator) {
  await field.and(field.page().locator(":focus-visible")).waitFor()
}

async function capture(page: Page, filename: string) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }))
  assert.equal(
    layout.contentWidth,
    layout.width,
    "The page should fit the viewport"
  )
  if (captures) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: join(captures, filename + ".png"),
      fullPage: true,
      animations: "disabled",
      style: "nextjs-portal { display: none }",
    })
  }
}

async function appearance(page: Page, theme: "Dark" | "Light") {
  const menu = page.getByRole("button", { name: "Open navigation" })
  const mobile = await menu.isVisible()
  if (mobile) await menu.click()
  await page.getByRole("button", { name: "Appearance" }).click()
  await page.getByRole("menuitemradio", { name: theme }).click()
  await page.locator("html." + theme.toLowerCase()).waitFor()
  if (mobile) await page.keyboard.press("Escape")
}

try {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(origin, { redirect: "manual" }).catch(
      () => null
    )
    if (response?.status === 307) break
    assert.ok(attempt < 120, "Next.js did not start")
    await setTimeout(250)
  }

  const response = await fetch(origin + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Income Preview",
      email: "income-" + randomUUID() + "@example.test",
      password: "disposable-test-password",
      inviteToken: await createSignupInvite(new Date(Date.now() + 600_000)),
    }),
  })
  assert.equal(
    response.status,
    200,
    response.ok ? undefined : await response.text()
  )
  const { user } = await response.json()
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
  })
  await context.addCookies(
    response.headers.getSetCookie().map((cookie) => {
      const [name, ...value] = cookie.split(";")[0].split("=")
      return { name, value: value.join("="), url: origin }
    })
  )
  const page = await context.newPage()
  const browserErrors: string[] = []
  page.on("pageerror", (error) => browserErrors.push(error.message))
  const heading = (name: string) =>
    page.getByRole("heading", { name, exact: true, level: 1 })
  const job = page.getByRole("textbox", { name: "Job title" })
  const gross = page.getByRole("textbox", {
    name: "Gross annual earnings (USD)",
  })
  const takeHome = page.getByRole("textbox", {
    name: "Take-home pay per paycheck (USD)",
  })
  const schedule = page.getByRole("combobox", { name: "Pay schedule" })
  const save = page.getByRole("button", { name: "Save income profile" })
  const edit = page.getByRole("button", { name: "Edit reported pay" })
  const saved = page.getByText("Income profile saved.", { exact: true })
  const compare = page.getByRole("main")

  await page.goto("/")
  await heading("Overview").waitFor()
  await page.getByRole("link", { name: /Set up income/ }).click()
  await page.waitForURL("**/income")
  await heading("Set up income").waitFor()
  await page
    .getByText("What you earn in a year before taxes and deductions.")
    .waitFor()
  await page
    .getByText("What you receive in one paycheck after taxes and deductions.")
    .waitFor()
  await page.getByText("No confirmed regular deposits yet.").waitFor()
  await capture(page, "01-first-run-desktop-light")

  await page.setViewportSize({ width: 390, height: 844 })
  await appearance(page, "Dark")
  await capture(page, "02-first-run-mobile-dark")
  await job.fill("Operations Coordinator")
  await gross.fill("85000")
  await takeHome.fill("2400")
  await save.press("Enter")
  await page.getByText("Choose a pay schedule.", { exact: true }).waitFor()
  await focused(schedule)
  await gross.fill("85,000")
  await takeHome.fill("0")
  await takeHome.press("Tab")
  await focused(schedule)
  await schedule.selectOption("biweekly")
  await schedule.press("Tab")
  await focused(save)
  await save.press("Enter")

  await page
    .getByRole("alert")
    .filter({ hasText: "Check the highlighted fields" })
    .waitFor()
  await focused(gross)
  assert.equal(
    await gross.getAttribute("aria-describedby"),
    "grossAnnual-hint grossAnnual-error"
  )
  assert.equal(await gross.inputValue(), "85,000")
  assert.equal(await takeHome.inputValue(), "0")
  assert.equal(await job.inputValue(), "Operations Coordinator")
  assert.equal(await schedule.inputValue(), "biweekly")
  await capture(page, "03-validation-mobile-dark")

  await gross.fill("85000")
  await takeHome.fill("2400")
  await takeHome.press("Enter")
  await heading("Income").waitFor()
  await saved.waitFor()
  await focused(edit)
  await job.waitFor({ state: "hidden" })
  await compare.getByText("$2,400.00", { exact: true }).waitFor()
  await compare.getByText("$85,000.00", { exact: true }).waitFor()

  await page.reload()
  await heading("Income").waitFor()
  await job.waitFor({ state: "hidden" })
  await compare.getByText("Operations Coordinator", { exact: true }).waitFor()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole("link", { name: "Overview", exact: true }).click()
  await heading("Overview").waitFor()
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Income", exact: true })
    .click()
  await heading("Income").waitFor()
  await edit.press("Enter")
  await focused(job)
  assert.equal(await edit.getAttribute("aria-expanded"), "true")
  assert.equal(await gross.inputValue(), "85000.00")
  assert.equal(await takeHome.inputValue(), "2400.00")
  assert.equal(await schedule.inputValue(), "biweekly")
  await job.fill("Discarded title")
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter")
  await focused(edit)
  await job.waitFor({ state: "hidden" })
  await edit.press("Enter")
  assert.equal(await job.inputValue(), "Operations Coordinator")
  await takeHome.fill("2450.75")
  await schedule.selectOption("weekly")
  await page
    .getByRole("button", { name: "Save changes", exact: true })
    .press("Enter")
  await saved.waitFor()
  await focused(edit)
  await page.reload()
  await compare.getByText("$2,450.75", { exact: true }).waitFor()
  await compare.getByText("Weekly", { exact: true }).waitFor()

  const [account] = await db
    .insert(financialAccount)
    .values({
      userId: user.id,
      name: "Checking",
      institution: "Example Bank",
    })
    .returning()
  const [regularImport, previewImport] = await db
    .insert(csvImport)
    .values([
      {
        accountId: account.id,
        fingerprint: randomUUID(),
        filename: "confirmed.csv",
        confirmedAt: new Date(),
        transactionCount: 5,
      },
      {
        accountId: account.id,
        fingerprint: randomUUID(),
        filename: "preview.csv",
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
      },
    ])
    .returning()
  await db.insert(financialTransaction).values([
    {
      importId: regularImport.id,
      sourceRow: 1,
      postedDate: "2026-10-30",
      description: "Payroll",
      amountCents: 238_125,
      spendingKind: "regular_pay",
    },
    {
      importId: regularImport.id,
      sourceRow: 2,
      postedDate: "2026-11-13",
      description: "Payroll",
      amountCents: 238_275,
      spendingKind: "regular_pay",
    },
    {
      importId: regularImport.id,
      sourceRow: 3,
      postedDate: "2026-11-10",
      description: "Bonus",
      amountCents: 10_000,
      spendingKind: "bonus",
    },
    {
      importId: previewImport.id,
      sourceRow: 1,
      postedDate: "2026-11-20",
      description: "Unconfirmed payroll",
      amountCents: 240_000,
      spendingKind: "regular_pay",
    },
  ])
  await page.reload()
  const table = page.getByRole("table")
  await page.getByText("Not enough deposit dates", { exact: true }).waitFor()
  await table.getByRole("cell", { name: "Nov 13, 2026" }).waitFor()
  assert.equal(await table.getByRole("row").count(), 3)
  assert.equal(
    await compare
      .getByText("Average take-home pay per paycheck", { exact: true })
      .count(),
    0
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await appearance(page, "Light")
  await capture(page, "04-sparse-mobile-light")

  await db.insert(financialTransaction).values({
    importId: regularImport.id,
    sourceRow: 4,
    postedDate: "2026-10-16",
    description: "Payroll",
    amountCents: 238_050,
    spendingKind: "regular_pay",
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload()
  await compare.getByText("$2,381.50", { exact: true }).waitFor()
  assert.deepEqual(await table.locator("time").allTextContents(), [
    "Nov 13, 2026",
    "Oct 30, 2026",
    "Oct 16, 2026",
  ])
  await capture(page, "05-populated-desktop-light")
  await appearance(page, "Dark")
  await edit.press("Enter")
  await focused(job)
  await capture(page, "06-edit-desktop-dark")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()

  await db.insert(financialTransaction).values({
    importId: regularImport.id,
    sourceRow: 5,
    postedDate: "2026-11-13",
    description: "Split payroll",
    amountCents: 23_800,
    spendingKind: "regular_pay",
  })
  await page.reload()
  await compare.getByText("Unclear pay schedule", { exact: true }).waitFor()
  assert.equal(await table.getByRole("row").count(), 5)
  assert.equal(
    await compare
      .getByText("Average take-home pay per paycheck", { exact: true })
      .count(),
    0
  )
  await page.setViewportSize({ width: 320, height: 740 })
  await capture(page, "07-unclear-mobile-dark")
  await compare
    .getByRole("link", { name: "Classify deposits in Monthly spending" })
    .click()
  await page.waitForURL("**/spending#transactions")
  await page.locator("#transactions").waitFor()
  assert.deepEqual(browserErrors, [])
  console.log("Income browser flow passed")
} finally {
  await browser.close()
  server.kill()
  await server.exited
  await pool.end()
}
