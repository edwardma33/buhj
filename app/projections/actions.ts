"use server"

import { notFound, redirect } from "next/navigation"

import {
  listFinancialAccounts,
  requireUserId,
  validUuid,
} from "@/app/financial-accounts/accounts"
import { categories, monthRange } from "@/app/spending/model"
import { listConfirmedSpending } from "@/app/spending/records"
import { reserveAiRequest } from "@/lib/ai/quota"
import { summarizeInsight } from "@/lib/insights/model"
import { payScheduleValues } from "@/lib/income"
import { listPayDifferences } from "@/lib/pay-review/records"
import {
  calculateProjection,
  daysBetween,
  projectionEvidence,
  type PayBaseline,
  type ProjectionSnapshot,
  type Scenario,
} from "@/lib/projections/model"
import { getProjectionPay } from "@/lib/projections/pay"
import { explainProjection } from "@/lib/projections/provider"
import { createResultDraft, saveResultDraft } from "@/lib/saved-results"

function readCents(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(value.trim()))
    return null
  const [dollars, fraction = ""] = value.trim().split(".")
  return BigInt(dollars) * BigInt(100) + BigInt(fraction.padEnd(2, "0"))
}

export async function generateProjection(_previous: string, form: FormData) {
  const userId = await requireUserId()
  const requestedMonth = form.get("month")
  const { month, start, end } = monthRange(requestedMonth)
  if (month !== requestedMonth) return "Choose a valid month."

  const baselineKind = form.get("baseline")
  if (
    baselineKind !== "reported" &&
    baselineKind !== "observed" &&
    baselineKind !== "revised"
  )
    return "Choose a Pay baseline."
  const asOf = new Date().toISOString().slice(0, 10)
  const kind = form.get("scenario")
  let scenario: Scenario
  if (kind === "spending") {
    const category = categories.find((value) => value === form.get("category"))
    const reduction = readCents(form.get("reduction"))
    if (!category || reduction === null || reduction <= BigInt(0))
      return "Choose a category and enter a positive USD reduction."
    scenario = { kind, category, reductionCents: reduction.toString() }
  } else if (kind === "target") {
    const starting = readCents(form.get("starting"))
    const target = readCents(form.get("target"))
    if (starting === null || target === null || target <= BigInt(0))
      return "Enter a starting amount of zero or more and a positive savings target."
    const date = form.get("targetDate")
    let targetDate = null
    if (date !== null && date !== "") {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return "Enter a valid future target date."
      const time = Date.parse(date)
      if (
        !Number.isFinite(time) ||
        new Date(time).toISOString().slice(0, 10) !== date ||
        daysBetween(asOf, date) <= 0
      )
        return "Enter a valid future target date."
      targetDate = date
    }
    scenario = {
      kind,
      startingCents: starting.toString(),
      targetCents: target.toString(),
      targetDate,
    }
  } else {
    return "Choose a scenario."
  }

  const reviewMonth = form.get("reviewMonth")
  let baseline: PayBaseline | null
  if (baselineKind === "revised") {
    if (typeof reviewMonth !== "string")
      return "Open Review forecast from the dashboard to use revised pay."
    const [review] = await listPayDifferences(userId, reviewMonth)
    if (!review || review.evidence !== form.get("reviewEvidence"))
      return "Pay evidence changed. Open Review forecast again from the dashboard."

    const paycheckCents = readCents(form.get("revisedPay"))
    const schedule = payScheduleValues.find(
      (value) => value === form.get("revisedSchedule")
    )
    if (!schedule || paycheckCents === null || paycheckCents <= BigInt(0))
      return "Enter positive take-home pay and choose a Pay schedule."
    baseline = {
      kind: "revised",
      schedule,
      paycheckCents: paycheckCents.toString(),
      reviewMonth,
    }
  } else {
    baseline = await getProjectionPay(userId, baselineKind)
    if (!baseline)
      return baselineKind === "reported"
        ? "Add your Reported pay in Income to use this baseline."
        : "Confirm enough regular deposits to establish an Observed pay schedule."
  }

  const accounts = await listFinancialAccounts()
  const entries = await listConfirmedSpending(
    accounts.map(({ id }) => id),
    start,
    end
  )
  const { sourcePeriod, inputs, values } = summarizeInsight(
    { start, end },
    entries
  )
  const purchases = values.categories.reduce(
    (sum, entry) => sum + entry.purchases,
    0
  )
  if (!purchases || !inputs.observedRange)
    return "Choose a month with recorded purchases or confirm more transactions."
  const netSpending = values.categories.reduce(
    (sum, entry) => sum + BigInt(entry.netCents),
    BigInt(0)
  )
  if (scenario.kind === "spending") {
    const category = values.categories.find(
      ({ category }) => category === scenario.category
    )
    if (
      !category?.purchases ||
      BigInt(category.netCents) < BigInt(scenario.reductionCents)
    ) {
      return "Choose a reduction within the category’s net spending for this month."
    }
  }

  const projection = calculateProjection({
    baseline,
    asOf,
    scenario,
    spending: {
      sourcePeriod,
      observedRange: inputs.observedRange,
      purchases,
      monthlySpendingCents: netSpending.toString(),
    },
  })

  const capped = await reserveAiRequest(userId)
  if (capped === "user")
    return "You reached your daily AI limit. Try again tomorrow (UTC)."
  if (capped === "app")
    return "Buhj reached its daily AI limit. Try again tomorrow (UTC)."

  let explanation: ProjectionSnapshot["explanation"]
  try {
    explanation = await explainProjection(projectionEvidence(projection))
  } catch {
    return "Buhj could not generate a Projection right now. Try again later."
  }
  const id = await createResultDraft(userId, { ...projection, explanation })
  redirect("/projections/" + id)
}

export async function saveProjection(form: FormData) {
  const userId = await requireUserId()
  const id = form.get("id")
  if (typeof id !== "string" || !validUuid(id)) notFound()
  if (!(await saveResultDraft(userId, id, "projection"))) notFound()
  redirect("/projections/" + id)
}
