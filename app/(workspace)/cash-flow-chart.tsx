import { formatUsd } from "./spending/model"

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
const shortMonth = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
})
const fullMonth = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function CashFlowChart({
  points,
}: {
  points: { month: string; net: bigint | null }[]
}) {
  const values = points.map(({ net }) => Number(net ?? 0) / 100)
  const largestInflow = Math.max(0, ...values)
  const largestOutflow = Math.max(0, ...values.map((value) => -value))
  const magnitude = Math.max(largestInflow, largestOutflow)
  const step = 10 ** Math.max(0, Math.floor(Math.log10(magnitude))) / 2
  const axisLimit = (side: number) =>
    side === 0 ? 0 : Math.ceil(Math.max(side, magnitude / 4) / step) * step
  const top = magnitude === 0 ? 1 : axisLimit(largestInflow)
  const floor = -axisLimit(largestOutflow)
  const percentFromTop = (value: number) =>
    ((top - value) / (top - floor)) * 100
  const ticks = Array.from(new Set([top, 0, floor]))
  const hasGaps = points.some(({ net }) => net === null)

  return (
    <figure
      aria-labelledby="overview-cash-flow"
      className="mt-4 flex flex-col gap-3 border-t pt-3"
    >
      <figcaption id="overview-cash-flow" className="font-medium">
        Net cash flow by month
      </figcaption>
      <div
        aria-hidden="true"
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2"
      >
        <div className="relative grid h-28 text-right text-xs text-muted-foreground tabular-nums">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="invisible relative col-start-1 row-start-1 whitespace-nowrap"
            >
              {compactUsd.format(tick)}
            </span>
          ))}
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: percentFromTop(tick) + "%" }}
            >
              {compactUsd.format(tick)}
            </span>
          ))}
        </div>
        <div
          className="relative grid min-w-0"
          style={{
            gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28">
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 border-t data-zero:border-input"
                data-zero={tick === 0 || undefined}
                style={{ top: percentFromTop(tick) + "%" }}
              />
            ))}
          </div>
          {points.map(({ month, net }, index) => {
            const value = values[index]
            const latest = index === points.length - 1
            const date = new Date(month + "-01T00:00:00Z")
            return (
              <div key={month} className="min-w-0 text-center">
                <div className="relative h-28">
                  {net !== null && (
                    <div
                      className="absolute left-1/2 min-h-px w-1/2 max-w-10 -translate-x-1/2 rounded-xs bg-chart-1/75 data-latest:bg-chart-1"
                      data-latest={latest || undefined}
                      style={{
                        top:
                          value === 0
                            ? "calc(" + percentFromTop(0) + "% - 1px)"
                            : percentFromTop(Math.max(value, 0)) + "%",
                        height: (Math.abs(value) / (top - floor)) * 100 + "%",
                      }}
                      title={fullMonth.format(date) + " · " + formatUsd(net)}
                    />
                  )}
                </div>
                <span
                  className="block pt-1 text-xs text-muted-foreground data-latest:font-semibold data-latest:text-foreground"
                  data-latest={latest || undefined}
                >
                  {shortMonth.format(date)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      {hasGaps && (
        <p className="text-xs text-muted-foreground">
          Gaps show months without confirmed transactions.
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer underline-offset-4 hover:underline">
          Monthly amounts
        </summary>
        <dl className="mt-2 grid max-w-xs">
          {points.map(({ month, net }) => (
            <div
              key={month}
              className="flex justify-between gap-4 border-t py-1.5"
            >
              <dt>{fullMonth.format(new Date(month + "-01T00:00:00Z"))}</dt>
              <dd className="text-right tabular-nums">
                {net === null ? "No confirmed transactions" : formatUsd(net)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </figure>
  )
}
