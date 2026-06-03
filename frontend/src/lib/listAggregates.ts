// Aggregator for the investment list-screen headline + time graph (issue
// #14, slice 14c). Pure: takes per-position {value, cost, snapshots,
// costSeries} and emits per-currency totals + per-currency monthly time
// series with carry-forward.
//
// **No FX.** Currencies stay separate, matching the no-FX convention on
// existing list-screen headlines (`lib/totals.ts`). Mixed-currency
// households get one card per currency.
//
// **Headline + count are active-only** (`activeCurrencyTotals` parity —
// closed positions have no current value/cost). **Time series includes
// terminated positions historically** (issue #21): each position
// contributes carry-forward up to and including its `terminated_at`
// month, then drops out. Without this, a sold/matured position
// vanishes from the chart entirely, hiding the portfolio's past
// shape.

export type Position = {
  id: string
  currency: string
  // `'active'` | `'sold'` | `'matured'` | …  Only `'active'` rows count
  // toward the headline; closed rows still appear in the time series up
  // to their `terminated_at` month.
  status: string
  // ISO timestamp for closed positions, null for active. Caps the
  // position's contribution to the time series at that YYYY-MM.
  terminated_at: string | null
  latestValue: number | null
  // "As of now" cost basis. Caller computes via lib/costBasis per the
  // subtype's quirk (ledger replay for Stock/MF/Gold/Bond-secondary;
  // flat face_value for Bond govt-primary; flat principal for TD).
  cost: number
  snapshots: Array<{ year_month: string; amount: string }>
  // Aligned with snapshots by year_month — caller computes via
  // costBasisSeries (ledger) or flatCostSeries (constant).
  costSeries: Array<{ year_month: string; cost: number }>
}

export type CurrencyAggregate = {
  currency: string
  value: number
  cost: number
  pl: number
}

export type TimePoint = {
  year_month: string // bare "YYYY-MM"
  value: number
  cost: number
}

export type ListAggregates = {
  byCurrency: CurrencyAggregate[] // value desc; currency code breaks ties
  timeSeriesByCurrency: Map<string, TimePoint[]>
  // Active positions that contributed a balance — for the "N stocks"
  // count under the headline.
  count: number
}

const monthOf = (s: string) => s.slice(0, 7)

export function aggregateListPositions(
  positions: Position[],
): ListAggregates {
  const active = positions.filter((p) => p.status === 'active')

  // Per-currency current totals.
  const currencyMap = new Map<
    string,
    { value: number; cost: number; count: number }
  >()
  for (const p of active) {
    const entry = currencyMap.get(p.currency) ?? {
      value: 0,
      cost: 0,
      count: 0,
    }
    if (p.latestValue !== null) {
      entry.value += p.latestValue
      entry.count++
    }
    // Cost always contributes — a position with no snapshot still has a
    // cost basis (e.g. a brand-new bond with face_value set).
    entry.cost += p.cost
    currencyMap.set(p.currency, entry)
  }

  const byCurrency: CurrencyAggregate[] = [...currencyMap.entries()]
    .map(([currency, { value, cost }]) => ({
      currency,
      value,
      cost,
      pl: value - cost,
    }))
    .sort(
      (a, b) => b.value - a.value || a.currency.localeCompare(b.currency),
    )

  // Per-currency monthly series (carry-forward). Includes closed
  // positions historically (issue #21) — `aggregateMonthly` caps each
  // position at its `terminated_at` month.
  const byCurrencyPositions = new Map<string, Position[]>()
  for (const p of positions) {
    if (!byCurrencyPositions.has(p.currency)) {
      byCurrencyPositions.set(p.currency, [])
    }
    byCurrencyPositions.get(p.currency)!.push(p)
  }

  const timeSeriesByCurrency = new Map<string, TimePoint[]>()
  for (const [currency, positionsInCurrency] of byCurrencyPositions) {
    const series = aggregateMonthly(positionsInCurrency)
    if (series.length > 0) {
      timeSeriesByCurrency.set(currency, series)
    }
  }

  // Active positions with a value — for the headline subline count.
  const count = active.filter((p) => p.latestValue !== null).length

  return { byCurrency, timeSeriesByCurrency, count }
}

// Walks the union of snapshot months across the positions in one
// currency. For each month M and each position p, picks p's latest
// snapshot at-or-before M (carry-forward) and its cost-basis at M, then
// sums. Cursors are per-position so the inner loop is O(1) amortized
// across the sorted months.
//
// Closed positions (terminated_at set) contribute their carry-forward
// up to and including their termination month, then 0 afterwards
// (issue #21). Without #17 their termination-month value will be the
// last pre-maturity snapshot rather than the realized payout; once #17
// lands the auto-snapshot will correct that.
function aggregateMonthly(positions: Position[]): TimePoint[] {
  type Sorted = {
    months: string[]
    values: number[]
    costs: number[]
    termMonth: string | null
  }
  const sorted: Sorted[] = positions.map((p) => {
    // Build {month → (value, cost)} so snapshot + cost lookups merge by
    // month even if the input arrays are in different orders.
    const byMonth = new Map<string, { value: number; cost: number }>()
    for (const s of p.snapshots) {
      byMonth.set(monthOf(s.year_month), {
        value: Number(s.amount),
        cost: 0,
      })
    }
    for (const c of p.costSeries) {
      const entry = byMonth.get(monthOf(c.year_month)) ?? {
        value: 0,
        cost: 0,
      }
      entry.cost = c.cost
      byMonth.set(monthOf(c.year_month), entry)
    }
    const months = [...byMonth.keys()].sort()
    return {
      months,
      values: months.map((m) => byMonth.get(m)!.value),
      costs: months.map((m) => byMonth.get(m)!.cost),
      termMonth: p.terminated_at ? monthOf(p.terminated_at) : null,
    }
  })

  const allMonths = [...new Set(sorted.flatMap((s) => s.months))].sort()
  if (allMonths.length === 0) return []

  const out: TimePoint[] = []
  const cursors = sorted.map(() => -1)
  for (const month of allMonths) {
    let value = 0
    let cost = 0
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].termMonth !== null && month > sorted[i].termMonth!) {
        continue
      }
      while (
        cursors[i] + 1 < sorted[i].months.length &&
        sorted[i].months[cursors[i] + 1] <= month
      ) {
        cursors[i]++
      }
      if (cursors[i] >= 0) {
        value += sorted[i].values[cursors[i]]
        cost += sorted[i].costs[cursors[i]]
      }
    }
    out.push({ year_month: month, value, cost })
  }
  return out
}
