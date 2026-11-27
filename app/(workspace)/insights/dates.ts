const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const periodFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const savedFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
})

function postedDate(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

export function formatSourceMonth(start: string) {
  return monthFormat.format(postedDate(start))
}

export function formatSourcePeriod({
  start,
  end,
}: {
  start: string
  end: string
}) {
  return periodFormat.formatRange(postedDate(start), postedDate(end))
}

export function formatSavedAt(date: Date) {
  return `${savedFormat.format(date)} UTC`
}
