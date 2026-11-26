"use server"

import { notFound, redirect } from "next/navigation"

import {
  listFinancialAccounts,
  requireUserId,
  validUuid,
} from "@/app/financial-accounts/accounts"
import { monthRange } from "@/app/spending/model"
import { listConfirmedSpending } from "@/app/spending/records"
import { reserveAiRequest } from "@/lib/ai/quota"
import {
  type InsightSnapshot,
  insightAssumptions,
  summarizeInsight,
  supportsSuggestion,
} from "@/lib/insights/model"
import { explainSpending } from "@/lib/insights/provider"
import { createInsightDraft, saveInsightDraft } from "@/lib/insights/records"

export async function generateInsight(_previous: string, formData: FormData) {
  const userId = await requireUserId()
  const requestedMonth = formData.get("month")
  const { month, start, end } = monthRange(requestedMonth)
  if (month !== requestedMonth) return "Choose a valid month."

  const accounts = await listFinancialAccounts()
  const entries = await listConfirmedSpending(
    accounts.map(({ id }) => id),
    start,
    end
  )
  const evidence = summarizeInsight({ start, end }, entries)
  if (!evidence.values.categories.some(supportsSuggestion)) {
    return "There is too little spending evidence for this month. Choose another month or confirm more transactions."
  }

  const capped = await reserveAiRequest(userId)
  if (capped === "user")
    return "You reached your daily AI limit. Try again tomorrow (UTC)."
  if (capped === "app")
    return "Buhj reached its daily AI limit. Try again tomorrow (UTC)."

  let explanation: InsightSnapshot["explanation"]
  try {
    explanation = await explainSpending(evidence.values.categories)
  } catch {
    return "Buhj could not generate an Insight right now. Try again later."
  }

  const id = await createInsightDraft(userId, {
    ...evidence,
    kind: "insight",
    version: 1,
    assumptions: insightAssumptions,
    explanation,
  })
  redirect("/insights/" + id)
}

export async function saveInsight(formData: FormData) {
  const userId = await requireUserId()
  const id = formData.get("id")
  if (typeof id !== "string" || !validUuid(id)) notFound()
  if (!(await saveInsightDraft(userId, id))) notFound()
  redirect("/insights/" + id)
}
