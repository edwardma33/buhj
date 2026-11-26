import { parse } from "csv-parse/sync"

export const MAX_CSV_BYTES = 512 * 1024
const MAX_ROWS = 1_000
const MAX_COLUMNS = 40

export type ColumnMapping = {
  date: number
  description: number
  amount: number
  sourceId: number | null
  sign: "positive-inflow" | "positive-outflow"
}

type TransactionData = {
  postedDate: string
  description: string
  amountCents: number
  sourceId: string | null
}

export type PreviewRow =
  | { row: number; transaction: TransactionData }
  | { row: number; issues: string[] }

export type Csv = { headers: string[]; rows: string[][] }

export function parseCsv(bytes: ArrayBuffer): Csv | null {
  try {
    const input = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    if (input.includes("\0")) return null
    const [headers, ...rows]: string[][] = parse(input, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      to: MAX_ROWS + 2,
    })
    if (
      !headers ||
      headers.length < 3 ||
      headers.length > MAX_COLUMNS ||
      rows.length < 1 ||
      rows.length > MAX_ROWS
    )
      return null
    return { headers, rows }
  } catch {
    return null
  }
}

const currencyHeader = /^(currency|currency[ _-]?code|ccy)$/i
const descriptionHeader = /description|memo|merchant|narrative|payee|details/i
const identifierHeader =
  /\bid\b|fitid|[ _-]id$|account|card|routing|reference|identifier|number|token|email|phone|name/i
const headerTerms = new Set(
  "account activity amount balance bank billing card ccy check code credit currency date debit details description dollars effective fitid gross id memo merchant narrative net number payee payment posted posting purchase ref reference settlement signed time total transaction trx type usd value withdrawal deposit".split(
    " "
  )
)

export function mappingSample({ headers, rows }: Csv) {
  return {
    headers: headers.map((header) => {
      const terms =
        header
          .slice(0, 120)
          .toLowerCase()
          .match(/[a-z]+/g) ?? []
      return (
        terms
          .filter((term) => headerTerms.has(term))
          .slice(0, 6)
          .join(" ") || "[redacted header]"
      )
    }),
    sample: rows
      .filter((row) => row.length === headers.length)
      .slice(0, 5)
      .map((row) =>
        headers.map((header, index) => {
          const value = row[index]
          if (!value || identifierHeader.test(header)) return null
          if (descriptionHeader.test(header)) return "[text]"
          return /^(?:USD *)?[-+$()\d.,/ ]{1,24}$/i.test(value)
            ? value.replace(/\d/g, "0")
            : "[text]"
        })
      ),
  }
}

export function validMapping(
  value: unknown,
  columnCount: number
): value is ColumnMapping {
  if (!value || typeof value !== "object") return false
  const { date, description, amount, sourceId, sign } = value as Record<
    string,
    unknown
  >
  const indexes = [date, description, amount]
  if (sourceId !== null) indexes.push(sourceId)
  return (
    indexes.every(
      (index) =>
        typeof index === "number" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < columnCount
    ) &&
    new Set(indexes).size === indexes.length &&
    (sign === "positive-inflow" || sign === "positive-outflow")
  )
}

function postedDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const numeric = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/.exec(value)
  let date: string
  if (iso) {
    date = value
  } else if (numeric) {
    const [, first, , second, year] = numeric
    if (
      Number(first) <= 12 &&
      Number(second) <= 12 &&
      Number(first) !== Number(second)
    )
      return null
    const [month, day] = Number(first) > 12 ? [second, first] : [first, second]
    date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  } else {
    return null
  }
  if (date.startsWith("0000")) return null
  const parsed = new Date(date)
  return Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null
}

function signedCents(value: string) {
  const inParentheses = value.startsWith("(") && value.endsWith(")")
  const amount = inParentheses ? value.slice(1, -1) : value
  const match =
    /^([+-]?)\s*(?:USD\s*|\$\s*)?(\d{1,9}|\d{1,3}(?:,\d{3}){1,2})(?:\.(\d{1,2}))?$/i.exec(
      amount
    )
  if (!match || (inParentheses && match[1])) return null
  const [, sign, whole, fraction = ""] = match
  const cents =
    Number(whole.replaceAll(",", "")) * 100 + Number(fraction.padEnd(2, "0"))
  return inParentheses || sign === "-" ? -cents : cents
}

export function previewRows(
  { headers, rows }: Csv,
  mapping: ColumnMapping
): PreviewRow[] {
  const currencyColumns = headers.flatMap((header, index) =>
    currencyHeader.test(header) ? [index] : []
  )
  return rows.map((cells, index) => {
    const row = index + 1
    if (cells.length !== headers.length) {
      return { row, issues: ["Column count differs from the header."] }
    }
    const date = postedDate(cells[mapping.date])
    const amount = signedCents(cells[mapping.amount])
    const description = cells[mapping.description]
    const sourceId =
      mapping.sourceId === null ? null : cells[mapping.sourceId] || null
    const issues = []
    if (!date) issues.push("Invalid or ambiguous date. Use YYYY-MM-DD.")
    if (amount === null) issues.push("Invalid signed USD amount.")
    if (!description || description.length > 500)
      issues.push("Description must contain 1 to 500 characters.")
    if (currencyColumns.some((column) => cells[column].toUpperCase() !== "USD"))
      issues.push("Only USD rows can be imported.")
    if (sourceId && sourceId.length > 250)
      issues.push("Source ID exceeds 250 characters.")
    if (issues.length || date === null || amount === null)
      return { row, issues }
    return {
      row,
      transaction: {
        postedDate: date,
        description,
        amountCents: mapping.sign === "positive-outflow" ? -amount : amount,
        sourceId,
      },
    }
  })
}
