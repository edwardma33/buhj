"use client"

import { ChevronDownIcon } from "lucide-react"
import Link from "next/link"
import { useActionState, useEffect, useRef } from "react"

import { Button, buttonVariants } from "@/components/ui/button"

import { keepForecast } from "./pay-review-actions"
import { PayReviewForm } from "./pay-review-form"
import { formatUsd } from "./spending/model"

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

function formatMonth(month: string) {
  return monthLabel.format(new Date(month + "-01T00:00:00Z"))
}

export function PayReview({
  differences,
  latestMonth,
}: {
  latestMonth: string
  differences: {
    month: string
    expectedCents: bigint
    confirmedCents: bigint
    evidence: string
  }[]
}) {
  const [status, keep, pending] = useActionState(keepForecast, null)
  const feedback = useRef<HTMLParagraphElement>(null)
  const message =
    status?.kind === "kept"
      ? `Forecast kept for ${formatMonth(status.month)}.`
      : status?.kind === "stale"
        ? "The pay comparison changed. Check the latest amounts before keeping your forecast."
        : ""

  useEffect(() => {
    if (message && document.activeElement === document.body) {
      feedback.current?.focus()
    }
  }, [message])

  return (
    <section
      aria-labelledby="overview-pay-review"
      className="flex flex-col gap-3 text-sm"
    >
      <h2 id="overview-pay-review" className="text-lg font-semibold">
        Pay review
      </h2>
      {differences.map(({ month, expectedCents, confirmedCents, evidence }) => {
        const difference = confirmedCents - expectedCents
        return (
          <article key={month} aria-labelledby={"pay-difference-" + month}>
            <h3 id={"pay-difference-" + month} className="pb-2 font-semibold">
              <time dateTime={month}>{formatMonth(month)}</time>
            </h3>
            <dl>
              {[
                {
                  label: "Expected pay",
                  note: "Reported pay × scheduled paydays",
                  amount: expectedCents,
                },
                {
                  label: "Confirmed pay",
                  note: "Regular pay deposits",
                  amount: confirmedCents,
                },
                { label: "Difference", amount: difference },
              ].map(({ label, note, amount }) => (
                <div
                  key={label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 border-t py-2"
                >
                  <dt className="font-medium">
                    {label}
                    {note && (
                      <span className="block text-xs font-normal text-muted-foreground sm:ml-2 sm:inline">
                        {note}
                      </span>
                    )}
                  </dt>
                  <dd
                    data-direction={
                      note ? undefined : amount < 0 ? "lower" : "higher"
                    }
                    className="text-right whitespace-nowrap tabular-nums data-[direction=higher]:font-semibold data-[direction=higher]:text-[var(--financial-positive)] data-[direction=lower]:font-semibold data-[direction=lower]:text-[var(--financial-negative)]"
                  >
                    {!note && amount > 0 ? "+" : ""}
                    {formatUsd(amount)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              <Link
                href={`/projections?month=${month}&payReview=${month}`}
                aria-label={`Review forecast for ${formatMonth(month)}`}
                className={buttonVariants({ className: "max-sm:min-h-10" })}
              >
                Review forecast
              </Link>
              <form action={keep}>
                <input type="hidden" name="month" value={month} />
                <input type="hidden" name="evidence" value={evidence} />
                <Button
                  type="submit"
                  variant="ghost"
                  aria-label={`Keep forecast for ${formatMonth(month)}`}
                  disabled={pending}
                  className="max-sm:min-h-10"
                >
                  Keep forecast
                </Button>
              </form>
            </div>
          </article>
        )
      })}
      {differences.length === 0 && !message && (
        <p className="text-muted-foreground">No outstanding pay differences.</p>
      )}
      <p
        ref={feedback}
        tabIndex={-1}
        role="status"
        className="text-muted-foreground empty:sr-only"
      >
        {message}
      </p>
      <details className="group border-y">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
          Compare a completed month
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground group-open:rotate-180"
          />
        </summary>
        <PayReviewForm latestMonth={latestMonth} />
      </details>
    </section>
  )
}
