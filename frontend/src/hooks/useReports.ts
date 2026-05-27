import { useQuery } from '@tanstack/react-query'
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
