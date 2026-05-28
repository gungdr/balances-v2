import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Me } from '@/hooks/useSession'

// Updates the current user's own profile (today: just the self-set nickname).
// Pass nickname: null (or "") to clear it. Refreshes the session — which
// carries the nickname for the "(you)" label — and the household-members list,
// whose picker options and ownership labels resolve nickname ?? display_name.
export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { nickname: string | null }) =>
      api<Me>('/api/me', { method: 'PATCH', body: JSON.stringify(p) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session'] })
      qc.invalidateQueries({ queryKey: ['household-members'] })
    },
  })
}
