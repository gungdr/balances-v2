import { lazy, Suspense } from 'react'

type SnapshotLike = {
  year_month: string
  amount: string
}

type Props = {
  snapshots: SnapshotLike[]
  currency: string
}

// Lazy boundary so recharts + the shadcn chart wrapper land in a
// separate chunk, fetched only when a detail page actually renders the
// chart. The empty-snapshot short-circuit stays out here so we don't
// even request the chunk on empty data.
const SnapshotChartImpl = lazy(() => import('./SnapshotChartImpl'))

export function SnapshotChart({ snapshots, currency }: Props) {
  if (snapshots.length === 0) return null
  return (
    <Suspense fallback={<div className="h-64 w-full" />}>
      <SnapshotChartImpl snapshots={snapshots} currency={currency} />
    </Suspense>
  )
}
