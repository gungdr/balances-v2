// Batch-fetch snapshots + transactions across many investment IDs at
// once, for the list-screen aggregates (issue #14, slice 14c).
//
// Uses `useQueries` to parallelise N per-position fetches; reuses the
// same query keys as `useInvestmentSnapshots` / `useInvestmentTransactions`
// so the cache is shared with the detail screens (clicking a list row
// hydrates the detail page instantly).
//
// Backend follow-up: issue #18 plans to fold `cost_basis` into each
// subtype's ListItem aggregate. Once that lands, transactions fetching
// can drop entirely; this hook becomes a snapshots-only batch (still
// needed for the time graph until a separate monthly-series endpoint
// exists too).

import { useQueries } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { InvestmentSnapshot, InvestmentTransaction } from '@/api/types'

export type BatchResult<T> = {
  // Per-id payload (empty array if still loading or errored).
  byId: Map<string, T[]>
  // True until every query has finished its initial load.
  isLoading: boolean
  // True if any query errored (the others may still have data).
  hasError: boolean
}

export function useInvestmentBatchSnapshots(
  ids: string[],
): BatchResult<InvestmentSnapshot> {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['investment-snapshots', id],
      queryFn: () =>
        api<InvestmentSnapshot[]>(`/api/investments/${id}/snapshots`),
    })),
  })
  return collect(ids, queries)
}

export function useInvestmentBatchTransactions(
  ids: string[],
): BatchResult<InvestmentTransaction> {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['investment-transactions', id],
      queryFn: () =>
        api<InvestmentTransaction[]>(`/api/investments/${id}/transactions`),
    })),
  })
  return collect(ids, queries)
}

type QueryLike<T> = {
  data?: T[]
  isPending: boolean
  isError: boolean
}

function collect<T>(ids: string[], queries: QueryLike<T>[]): BatchResult<T> {
  const byId = new Map<string, T[]>()
  let isLoading = false
  let hasError = false
  for (let i = 0; i < ids.length; i++) {
    const q = queries[i]
    byId.set(ids[i], q.data ?? [])
    if (q.isPending) isLoading = true
    if (q.isError) hasError = true
  }
  return { byId, isLoading, hasError }
}
