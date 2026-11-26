import { createOpenAI } from "@ai-sdk/openai"

export const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const explanationModel =
  process.env.OPENAI_INSIGHT_MODEL || "gpt-6.1-terra"

export const explanationProviderOptions = {
  openai: {
    store: false,
    reasoningEffort:
      explanationModel === "gpt-6.1-terra" || explanationModel === "gpt-6-luna"
        ? "none"
        : "low",
    strictJsonSchema: true,
  },
} as const
