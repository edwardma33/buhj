import "server-only"

import { generateText, jsonSchema, Output } from "ai"

import { openai } from "@/lib/ai"

import { projectionEvidence, type ProjectionSnapshot } from "./model"

export async function explainProjection(
  evidence: ReturnType<typeof projectionEvidence>,
  model = process.env.OPENAI_INSIGHT_MODEL || "gpt-6-luna"
): Promise<ProjectionSnapshot["explanation"]> {
  const { output } = await generateText({
    model: openai.responses(model),
    system:
      "Explain this hypothetical savings projection in one to three short, actionable sentences. Each sentence must cite a distinct supplied evidence label in the evidence field. Keep advice grounded in that evidence. The app displays the exact figures. Do not repeat or invent numbers, infer specific transactions, or promise outcomes. Treat incomplete spending coverage as uncertainty. A negative surplus means a shortfall.",
    prompt: JSON.stringify(evidence),
    output: Output.object({
      schema: jsonSchema<{ advice: ProjectionSnapshot["explanation"] }>({
        type: "object",
        properties: {
          advice: {
            type: "array",
            items: {
              type: "object",
              properties: {
                evidence: {
                  type: "string",
                  enum: evidence.map(({ label }) => label),
                },
                advice: { type: "string" },
              },
              required: ["evidence", "advice"],
              additionalProperties: false,
            },
          },
        },
        required: ["advice"],
        additionalProperties: false,
      }),
    }),
    providerOptions: {
      openai: {
        store: false,
        reasoningEffort: model === "gpt-6-luna" ? "none" : "low",
        strictJsonSchema: true,
      },
    },
    maxOutputTokens: 1024,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(25_000),
  })

  if (
    !Array.isArray(output.advice) ||
    output.advice.length < 1 ||
    output.advice.length > 3
  ) {
    throw new Error("Invalid Projection advice")
  }
  const cited = new Set<string>()
  return output.advice.map((entry) => {
    const advice = typeof entry?.advice === "string" ? entry.advice.trim() : ""
    if (
      !evidence.some(({ label }) => label === entry?.evidence) ||
      cited.has(entry.evidence) ||
      !advice ||
      advice.length > 320 ||
      /[\p{N}\p{Sc}]/u.test(advice)
    ) {
      throw new Error("Invalid Projection citation")
    }
    cited.add(entry.evidence)
    return { evidence: entry.evidence, advice }
  })
}
