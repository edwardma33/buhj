import { randomInt } from "node:crypto"
import { createInterface } from "node:readline/promises"

import {
  calculateProjection,
  projectionEvidence,
  type PayBaseline,
  type Scenario,
} from "../lib/projections/model"
import { explainProjection } from "../lib/projections/provider"

const models = ["gpt-6.1-terra", "gpt-6.2-sol"]
const key = process.env.OPENAI_API_KEY
if (!key || process.env.OPENAI_BASE_URL) {
  throw new Error(
    "Set OPENAI_API_KEY to an approved non-production project key and unset OPENAI_BASE_URL."
  )
}

for (const model of models) {
  const access = await fetch("https://api.openai.com/v1/models/" + model, {
    headers: { authorization: "Bearer " + key },
    signal: AbortSignal.timeout(10_000),
  })
  if (!access.ok)
    throw new Error(
      `Model access check failed for ${model} (HTTP ${access.status}).`
    )
}

const reported: PayBaseline = {
  kind: "reported",
  schedule: "monthly",
  paycheckCents: "220000",
}
const observed: PayBaseline = {
  kind: "observed",
  schedule: "biweekly",
  paycheckCents: "130000",
  sampleSize: 5,
  latestPayday: "2026-10-30",
}
const cases: {
  name: string
  baseline: PayBaseline
  spendingCents: string
  scenario: Scenario
  expected: string
}[] = [
  {
    name: "Reported pay and a category reduction",
    baseline: reported,
    spendingCents: "180000",
    scenario: { kind: "spending", category: "Dining", reductionCents: "8500" },
    expected:
      "Explain the category cut as hypothetical and suggest a way to try or review it.",
  },
  {
    name: "Observed pay and a dated shortfall",
    baseline: observed,
    spendingCents: "310000",
    scenario: {
      kind: "target",
      startingCents: "20000",
      targetCents: "180000",
      targetDate: "2026-12-01",
    },
    expected:
      "Recognize the shortfall and suggest changing spending or the deadline. Avoid treating the required rate as achievable.",
  },
  {
    name: "Undated target and sparse spending coverage",
    baseline: reported,
    spendingCents: "12000",
    scenario: {
      kind: "target",
      startingCents: "50000",
      targetCents: "80000",
      targetDate: null,
    },
    expected:
      "Give a next step that accounts for unknown coverage. Avoid inventing a deadline or a required rate.",
  },
]

const results = []
for (const test of cases) {
  const evidence = projectionEvidence(
    calculateProjection({
      asOf: "2026-11-01",
      baseline: test.baseline,
      spending: {
        sourcePeriod: { start: "2026-10-01", end: "2026-10-31" },
        observedRange: { start: "2026-10-03", end: "2026-10-07" },
        purchases: 3,
        monthlySpendingCents: test.spendingCents,
      },
      scenario: test.scenario,
    })
  )
  const responses = []
  for (const model of models) {
    try {
      responses.push({
        model,
        advice: await explainProjection(evidence, model),
      })
    } catch {
      responses.push({ model, advice: null })
      process.exitCode = 1
    }
  }
  results.push({
    case: test.name,
    evidence,
    expected: test.expected,
    responses,
  })
}

const rubric = {
  evidenceFidelity:
    "0 = contradicts evidence, invents a claim, or invalid response. 1 = mostly grounded with an unsupported inference or missing material caveat. 2 = every claim follows from its citation and respects uncertainty.",
  actionability:
    "0 = no feasible next step or invalid response. 1 = generic but feasible next step. 2 = concrete next step specific to the scenario and its constraints.",
}
console.log(JSON.stringify({ rubric }, null, 2))

if (!process.stdin.isTTY) {
  console.log(
    JSON.stringify(
      {
        review: "Score semantic fidelity and actionability using the rubric.",
        results,
      },
      null,
      2
    )
  )
} else {
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const scores = []
  try {
    for (const { responses, ...test } of results) {
      if (randomInt(2)) responses.reverse()
      console.log(JSON.stringify(test, null, 2))
      for (const response of responses) {
        console.log(JSON.stringify(response.advice, null, 2))
        let answer = "0 0"
        if (response.advice) {
          do {
            answer = (
              await input.question(
                "Evidence fidelity and actionability scores (e.g. 2 1): "
              )
            ).trim()
          } while (!/^[0-2] [0-2]$/.test(answer))
        }
        const [evidenceFidelity, actionability] = answer.split(" ").map(Number)
        scores.push({
          case: test.case,
          model: response.model,
          evidenceFidelity,
          actionability,
        })
      }
    }
  } finally {
    input.close()
  }
  console.table(scores)
}
