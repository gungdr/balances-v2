import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { MonthlyReport } from '@/api/types'

// The dashboard's net-worth series. The backend regenerates stale months on
// read (ADR-0006), so this is a plain fetch; mutations elsewhere (snapshots,
// positions) should invalidate ['reports'] to pull a fresh series.
export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => api<MonthlyReport[]>('/api/reports'),
    staleTime: 10_000,
  })
}

// Manual rebuild (ADR-0006). The data-driven staleness watermark can't detect
// engine-code changes, so a force-rebuild is the escape hatch. Two scopes:
// rebuild-all (engine/FX changes that ripple across history) and rebuild-month
// (surgical fix). Both invalidate the series so the dashboard re-reads.
export function useRebuildReports() {
  const qc = useQueryClient()

  const rebuildAll = useMutation({
    mutationFn: () => api('/api/reports/rebuild', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const rebuildMonth = useMutation({
    // yearMonth is the report's full ISO date; the endpoint accepts YYYY-MM.
    mutationFn: (yearMonth: string) =>
      api(`/api/reports/${yearMonth.slice(0, 7)}/rebuild`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  return { rebuildAll, rebuildMonth }
}
