import { lazy, Suspense } from 'react'

type SnapshotLike = {
  year_month: string
  amount: string
}

type CostPoint = {
  year_month: string
  cost: number
}

type Props = {
  snapshots: SnapshotLike[]
  currency: string
  // Optional parallel cost-basis series (one entry per snapshot, same
  // year_month values). When provided, renders a second line in muted
  // slate beneath the value area — the gap reads as unrealized P/L.
  // Investment detail screens pass this via `lib/costBasis`; non-
  // investment groups (assets / liabilities / receivables) omit it.
  costSeries?: CostPoint[]
}

// Lazy boundary so recharts + the shadcn chart wrapper land in a
// separate chunk, fetched only when a detail page actually renders the
// chart. The empty-snapshot short-circuit stays out here so we don't
// even request the chunk on empty data.
const SnapshotChartImpl = lazy(() => import('./SnapshotChartImpl'))

export function SnapshotChart({ snapshots, currency, costSeries }: Props) {
  if (snapshots.length === 0) return null
  return (
    <Suspense fallback={<div className="h-64 w-full" />}>
      <SnapshotChartImpl
        snapshots={snapshots}
        currency={currency}
        costSeries={costSeries}
      />
    </Suspense>
  )
}
