import "server-only"

import { generateText, jsonSchema, Output } from "ai"

import { formatUsd } from "@/app/(workspace)/spending/model"
import { explanationModel, explanationProviderOptions, openai } from "@/lib/ai"

import { type InsightSnapshot, supportsSuggestion } from "./model"

export async function explainSpending(
  categories: InsightSnapshot["values"]["categories"]
): Promise<InsightSnapshot["explanation"]> {
  const evidence = categories.filter(supportsSuggestion).map((entry) => ({
    category: entry.category,
    netSpending: formatUsd(BigInt(entry.netCents)),
    purchases: entry.purchases,
    purchaseDays: entry.purchaseDays,
  }))
  const { output } = await generateText({
    model: openai.responses(explanationModel),
    system:
      "Use the supplied category aggregates to suggest one to three practical ways to review or reduce spending. Cite each suggestion by its category field. The app shows the exact numbers separately. Write one short advice sentence per category, using distinct categories. Do not include numbers, amounts, savings estimates, merchant names, or claims about individual purchases, recurring charges, or past or future months. Use conditional advice when the data does not show a specific action.",
    prompt: JSON.stringify(evidence),
    output: Output.object({
      schema: jsonSchema<{
        suggestions: { category: string; advice: string }[]
      }>({
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: evidence.map((entry) => entry.category),
                },
                advice: { type: "string" },
              },
              required: ["category", "advice"],
              additionalProperties: false,
            },
          },
        },
        required: ["suggestions"],
        additionalProperties: false,
      }),
    }),
    providerOptions: explanationProviderOptions,
    maxOutputTokens: 420,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(15_000),
  })

  const { suggestions } = output
  if (
    !Array.isArray(suggestions) ||
    suggestions.length < 1 ||
    suggestions.length > 3
  ) {
    throw new Error("Invalid Insight suggestions")
  }

  const seen = new Set<string>()
  return suggestions.map((suggestion) => {
    const entry = evidence.find(
      ({ category }) => category === suggestion?.category
    )
    const advice =
      typeof suggestion?.advice === "string" ? suggestion.advice.trim() : ""
    if (
      !entry ||
      seen.has(entry.category) ||
      !advice ||
      advice.length > 320 ||
      /[\p{N}\p{Sc}]/u.test(advice)
    ) {
      throw new Error("Invalid Insight suggestion")
    }
    seen.add(entry.category)
    return { category: entry.category, advice }
  })
}
