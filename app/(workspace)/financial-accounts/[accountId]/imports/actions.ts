"use server"

import { createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { notFound, redirect } from "next/navigation"

import { reserveAiRequest } from "@/lib/ai/quota"
import { MAX_CSV_BYTES, parseCsv, previewRows } from "@/lib/csv-import/csv"
import {
  cancelCsvImport,
  confirmCsvImport,
  correctCsvRow,
  deleteExpiredPreviews,
  findExistingImport,
  savePreview,
} from "@/lib/csv-import/imports"
import { proposeMapping } from "@/lib/csv-import/mapping"

import { getFinancialAccount, validUuid } from "../../accounts"

export async function uploadCsv(
  accountId: string,
  _previous: string,
  formData: FormData
) {
  const account = await getFinancialAccount(accountId)
  const file = formData.get("csv")
  if (!(file instanceof File) || !file.size || !/\.csv$/i.test(file.name))
    return "Choose a CSV file."
  if (file.size > MAX_CSV_BYTES) return "Choose a CSV file smaller than 512 KB."

  const accountPath = `/financial-accounts/${account.id}`
  const bytes = await file.arrayBuffer()
  const fingerprint = createHash("sha256")
    .update(new Uint8Array(bytes))
    .digest("hex")
  await deleteExpiredPreviews(account.id)
  const existing = await findExistingImport(account.id, fingerprint)
  if (existing) redirect(`${accountPath}/imports/${existing}`)

  const csv = parseCsv(bytes)
  if (!csv)
    return "Use a UTF-8 CSV with a header and up to 1,000 rows and 40 columns."

  const limit = await reserveAiRequest(account.userId)
  if (limit === "user")
    return "You reached your daily AI limit. Try again tomorrow after midnight UTC."
  if (limit === "app")
    return "Buhj reached its daily AI limit. Try again tomorrow after midnight UTC."

  let mapping
  try {
    mapping = await proposeMapping(csv)
  } catch {
    return "Luna could not map this CSV right now. Try again in a moment."
  }
  if (!mapping)
    return "Use a CSV with date, description, and either a signed USD amount column or separate debit and credit columns."

  const columnName = (index: number) =>
    csv.headers[index].slice(0, 120) || `Column ${index + 1}`

  const id = await savePreview({
    accountId: account.id,
    fingerprint,
    filename:
      file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) ||
      "Transactions.csv",
    preview: {
      columns: {
        date: columnName(mapping.date),
        description: columnName(mapping.description),
        ...("amount" in mapping
          ? { amount: columnName(mapping.amount), sign: mapping.sign }
          : {
              debit: columnName(mapping.debit),
              credit: columnName(mapping.credit),
            }),
      },
      rows: previewRows(csv, mapping),
    },
  })
  revalidatePath(accountPath)
  redirect(`${accountPath}/imports/${id}`)
}

export async function confirmImport(
  accountId: string,
  importId: string,
  corrections: number,
  fields: FormData
) {
  const account = await getFinancialAccount(accountId)
  if (!validUuid(importId)) notFound()
  const result = await confirmCsvImport(
    account.id,
    importId,
    corrections,
    fields
  )
  if (result === "unavailable") notFound()
  const accountPath = `/financial-accounts/${account.id}`
  const importPath = `${accountPath}/imports/${importId}`
  revalidatePath(accountPath)
  redirect(
    result === "confirmed" ? importPath : `${importPath}?notice=${result}`
  )
}

export async function correctImportRow(
  accountId: string,
  importId: string,
  sourceRow: number,
  fields: FormData
) {
  const account = await getFinancialAccount(accountId)
  if (!validUuid(importId)) notFound()
  const result = await correctCsvRow(account.id, importId, sourceRow, fields)
  if (result === "unavailable") notFound()
  const path = `/financial-accounts/${account.id}/imports/${importId}`
  revalidatePath(path)
  redirect(
    result === "invalid" ? `${path}?notice=invalid&row=${sourceRow}` : path
  )
}

export async function cancelImport(accountId: string, importId: string) {
  const account = await getFinancialAccount(accountId)
  if (!validUuid(importId)) notFound()
  await cancelCsvImport(account.id, importId)
  const accountPath = `/financial-accounts/${account.id}`
  revalidatePath(accountPath)
  redirect(accountPath)
}
