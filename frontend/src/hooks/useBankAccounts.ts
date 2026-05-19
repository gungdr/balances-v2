import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  BankAccount,
  BankAccountListItem,
  AssetSnapshot,
} from '@/api/types'

// ----- bank accounts -------------------------------------------------------

export type CreateBankAccountPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  bank_name: string
  account_number: string
  account_type: 'savings' | 'current' | 'other'
}

export type UpdateBankAccountPayload = {
  display_name: string
  description: string | null
  bank_name: string
  account_number: string
  account_type: 'savings' | 'current' | 'other'
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => api<BankAccountListItem[]>('/api/bank-accounts'),
    staleTime: 10_000,
  })
}

export function useBankAccount(id: string | null) {
  return useQuery({
    queryKey: ['bank-accounts', id],
    queryFn: () => api<BankAccount>(`/api/bank-accounts/${id}`),
    enabled: !!id,
  })
}

export function useCreateBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBankAccountPayload) =>
      api<BankAccount>('/api/bank-accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
  })
}

export function useUpdateBankAccount(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateBankAccountPayload) =>
      api<BankAccount>(`/api/bank-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-accounts', id] })
    },
  })
}

export function useDeleteBankAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/bank-accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
  })
}

// ----- snapshots -----------------------------------------------------------

export type CreateSnapshotPayload = {
  year_month: string // "YYYY-MM" or "YYYY-MM-DD"
  amount: string
  currency: string
  as_of_date: string | null
  description: string | null
}

export function useSnapshots(assetId: string | null) {
  return useQuery({
    queryKey: ['snapshots', assetId],
    queryFn: () =>
      api<AssetSnapshot[]>(`/api/bank-accounts/${assetId}/snapshots`),
    enabled: !!assetId,
  })
}

export function useCreateSnapshot(assetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSnapshotPayload) =>
      api<AssetSnapshot>(`/api/bank-accounts/${assetId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', assetId] })
      // The list view shows latest_snapshot inline, so invalidate it too.
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
  })
}
