// Cross-subtype aggregator for the Investments **home** screen (issue #14
// slice 14d). Sibling to `lib/listAggregates.ts` — that one runs per
// list screen on a single subtype; this one merges all 5 subtypes
// (stock / mutualFund / bond / timeDeposit / gold) into one set of
// per-currency cards.
//
// No FX. Same convention as the 14c list-screen graphs: separate
// currencies are reported in their own cards (one set of 4 charts per
// currency), so a multi-currency household sees 4 × N cards.
//
// Active-only. Terminated positions drop out of every output.
//
// Extends listAggregates with:
//   - categorySeriesByCurrency: monthly value share per category, carry-
//     forward, for the 100%-stacked area chart;
//   - categoryPieByCurrency: current value per category, for the pie;
//   - riskPieByCurrency: current value per risk profile, for the pie.

import {
  aggregateListPositions,
  type CurrencyAggregate,
  type Position,
  type TimePoint,
} from '@/lib/listAggregates'

export type InvestmentCategory =
  | 'stock'
  | 'mutualFund'
  | 'bond'
  | 'timeDeposit'
  | 'gold'

export type InvestmentRiskProfile = 'low' | 'medium' | 'high'

export const INVESTMENT_CATEGORIES: InvestmentCategory[] = [
  'stock',
  'mutualFund',
  'bond',
  'timeDeposit',
  'gold',
]

export const INVESTMENT_RISK_PROFILES: InvestmentRiskProfile[] = [
  'low',
  'medium',
  'high',
]

export type HomePosition = Position & {
  category: InvestmentCategory
  riskProfile: InvestmentRiskProfile
}

export type CategoryTimePoint = {
  year_month: string
  byCategory: Record<InvestmentCategory, number>
}

export type CategorySlice = {
  category: InvestmentCategory
  value: number
}

export type RiskSlice = {
  profile: InvestmentRiskProfile
  value: number
}

export type HomeAggregates = {
  byCurrency: CurrencyAggregate[]
  timeSeriesByCurrency: Map<string, TimePoint[]>
  categorySeriesByCurrency: Map<string, CategoryTimePoint[]>
  categoryPieByCurrency: Map<string, CategorySlice[]>
  riskPieByCurrency: Map<string, RiskSlice[]>
  count: number
}

const monthOf = (s: string) => s.slice(0, 7)

const emptyByCategory = (): Record<InvestmentCategory, number> => ({
  stock: 0,
  mutualFund: 0,
  bond: 0,
  timeDeposit: 0,
  gold: 0,
})

export function aggregateHomePositions(
  positions: HomePosition[],
): HomeAggregates {
  const active = positions.filter((p) => p.status === 'active')

  // Value/cost headline + per-currency time series come straight from the
  // list aggregator. Strip the extra fields so the call is type-clean.
  const base = aggregateListPositions(
    active.map((p) => ({
      id: p.id,
      currency: p.currency,
      status: p.status,
      latestValue: p.latestValue,
      cost: p.cost,
      snapshots: p.snapshots,
      costSeries: p.costSeries,
    })),
  )

  // Group active positions by currency for the new outputs.
  const byCurrencyPositions = new Map<string, HomePosition[]>()
  for (const p of active) {
    if (!byCurrencyPositions.has(p.currency)) {
      byCurrencyPositions.set(p.currency, [])
    }
    byCurrencyPositions.get(p.currency)!.push(p)
  }

  const categorySeriesByCurrency = new Map<string, CategoryTimePoint[]>()
  const categoryPieByCurrency = new Map<string, CategorySlice[]>()
  const riskPieByCurrency = new Map<string, RiskSlice[]>()

  for (const [currency, ps] of byCurrencyPositions) {
    const series = aggregateMonthlyByCategory(ps)
    if (series.length > 0) {
      categorySeriesByCurrency.set(currency, series)
    }
    categoryPieByCurrency.set(currency, currentCategoryPie(ps))
    riskPieByCurrency.set(currency, currentRiskPie(ps))
  }

  return {
    byCurrency: base.byCurrency,
    timeSeriesByCurrency: base.timeSeriesByCurrency,
    categorySeriesByCurrency,
    categoryPieByCurrency,
    riskPieByCurrency,
    count: base.count,
  }
}

// Carry-forward monthly walk, same cursor pattern as listAggregates'
// aggregateMonthly. For each month and each position, picks the
// latest-at-or-before snapshot value and attributes it to the position's
// category. Cost is not needed here — the stacked chart is share-of-value.
function aggregateMonthlyByCategory(
  positions: HomePosition[],
): CategoryTimePoint[] {
  type Sorted = {
    category: InvestmentCategory
    months: string[]
    values: number[]
  }
  const sorted: Sorted[] = positions.map((p) => {
    const byMonth = new Map<string, number>()
    for (const s of p.snapshots) {
      byMonth.set(monthOf(s.year_month), Number(s.amount))
    }
    const months = [...byMonth.keys()].sort()
    return {
      category: p.category,
      months,
      values: months.map((m) => byMonth.get(m)!),
    }
  })

  const allMonths = [...new Set(sorted.flatMap((s) => s.months))].sort()
  if (allMonths.length === 0) return []

  const out: CategoryTimePoint[] = []
  const cursors = sorted.map(() => -1)
  for (const month of allMonths) {
    const byCategory = emptyByCategory()
    for (let i = 0; i < sorted.length; i++) {
      while (
        cursors[i] + 1 < sorted[i].months.length &&
        sorted[i].months[cursors[i] + 1] <= month
      ) {
        cursors[i]++
      }
      if (cursors[i] >= 0) {
        byCategory[sorted[i].category] += sorted[i].values[cursors[i]]
      }
    }
    out.push({ year_month: month, byCategory })
  }
  return out
}

function currentCategoryPie(positions: HomePosition[]): CategorySlice[] {
  const totals = emptyByCategory()
  for (const p of positions) {
    if (p.latestValue === null) continue
    totals[p.category] += p.latestValue
  }
  // Always emit all 5 keys, even at zero, so a chart legend can render a
  // stable order. Empty slices render as no arc.
  return INVESTMENT_CATEGORIES.map((category) => ({
    category,
    value: totals[category],
  }))
}

function currentRiskPie(positions: HomePosition[]): RiskSlice[] {
  const totals: Record<InvestmentRiskProfile, number> = {
    low: 0,
    medium: 0,
    high: 0,
  }
  for (const p of positions) {
    if (p.latestValue === null) continue
    totals[p.riskProfile] += p.latestValue
  }
  return INVESTMENT_RISK_PROFILES.map((profile) => ({
    profile,
    value: totals[profile],
  }))
}
