"use server"

import { notFound, redirect } from "next/navigation"

import {
  listFinancialAccounts,
  requireUserId,
  validUuid,
} from "@/app/(workspace)/financial-accounts/accounts"
import { monthRange } from "@/app/(workspace)/spending/model"
import { listConfirmedSpending } from "@/app/(workspace)/spending/records"
import { reserveAiRequest } from "@/lib/ai/quota"
import {
  type InsightSnapshot,
  insightAssumptions,
  summarizeInsight,
  supportsSuggestion,
} from "@/lib/insights/model"
import { explainSpending } from "@/lib/insights/provider"
import { createResultDraft, saveResultDraft } from "@/lib/saved-results"

type GenerationFeedback = {
  kind: "invalid-month" | "insufficient" | "limit" | "provider"
  title: string
  description: string
}

export async function generateInsight(
  _previous: GenerationFeedback | null,
  formData: FormData
): Promise<GenerationFeedback> {
  const userId = await requireUserId()
  const requestedMonth = formData.get("month")
  const { month, start, end } = monthRange(requestedMonth)
  if (month !== requestedMonth) {
    return {
      kind: "invalid-month",
      title: "Choose a valid month",
      description: "Enter a month and year, then try again.",
    }
  }

  const accounts = await listFinancialAccounts()
  const entries = await listConfirmedSpending(
    accounts.map(({ id }) => id),
    start,
    end
  )
  const evidence = summarizeInsight({ start, end }, entries)
  if (!evidence.values.categories.some(supportsSuggestion)) {
    return {
      kind: "insufficient",
      title: "Too little spending evidence",
      description:
        "Choose another month or confirm more transactions. A category needs purchases on at least two dates and positive net spending.",
    }
  }

  const capped = await reserveAiRequest(userId)
  if (capped) {
    return {
      kind: "limit",
      title:
        capped === "user"
          ? "You reached your daily AI limit"
          : "Buhj reached its daily AI limit",
      description:
        "Try again after midnight UTC. You can still open saved Insights.",
    }
  }

  let explanation: InsightSnapshot["explanation"]
  try {
    explanation = await explainSpending(evidence.values.categories)
  } catch {
    return {
      kind: "provider",
      title: "Buhj could not generate an Insight",
      description: "Try again in a moment. Your month selection is still here.",
    }
  }

  const id = await createResultDraft(userId, {
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
  if (!(await saveResultDraft(userId, id, "insight"))) notFound()
  redirect("/insights/" + id)
}
