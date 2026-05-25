import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { LifecycleGroup } from '@/lib/lifecycle'

// PATCH /api/{group}/{id}/lifecycle. The backend operates on the parent table
// (4 groups, not the 10 subtypes), so every subtype detail page funnels through
// the same endpoint — the caller passes its own list query-key so we can
// invalidate both the list and the single-row cache after a status change.
export type LifecyclePayload = {
  status: string
  terminated_at: string | null
  termination_note: string | null
}

export function useUpdateLifecycle(
  group: LifecycleGroup,
  id: string,
  listKey: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LifecyclePayload) =>
      api(`/api/${group}/${id}/lifecycle`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [listKey] })
      qc.invalidateQueries({ queryKey: [listKey, id] })
    },
  })
}
