import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  Gold,
  GoldListItem,
  MutualFund,
  MutualFundListItem,
  Stock,
  StockListItem,
} from '@/api/types'

// ----- stock -----------------------------------------------------------

export type CreateStockPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  ticker: string
  exchange: string
}

export type UpdateStockPayload = {
  display_name: string
  description: string | null
  ticker: string
  exchange: string
}

export function useStocks() {
  return useQuery({
    queryKey: ['stocks'],
    queryFn: () => api<StockListItem[]>('/api/investments/stocks'),
    staleTime: 10_000,
  })
}

export function useStock(id: string | null) {
  return useQuery({
    queryKey: ['stocks', id],
    queryFn: () => api<Stock>(`/api/investments/stocks/${id}`),
    enabled: !!id,
  })
}

export function useCreateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateStockPayload) =>
      api<Stock>('/api/investments/stocks', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
    },
  })
}

export function useUpdateStock(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateStockPayload) =>
      api<Stock>(`/api/investments/stocks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['stocks', id] })
    },
  })
}

export function useDeleteStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/investments/stocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
    },
  })
}

// ----- mutual fund -----------------------------------------------------

export type CreateMutualFundPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  fund_code: string
  fund_manager: string | null
}

export type UpdateMutualFundPayload = {
  display_name: string
  description: string | null
  fund_code: string
  fund_manager: string | null
}

export function useMutualFunds() {
  return useQuery({
    queryKey: ['mutual-funds'],
    queryFn: () => api<MutualFundListItem[]>('/api/investments/mutual-funds'),
    staleTime: 10_000,
  })
}

export function useMutualFund(id: string | null) {
  return useQuery({
    queryKey: ['mutual-funds', id],
    queryFn: () => api<MutualFund>(`/api/investments/mutual-funds/${id}`),
    enabled: !!id,
  })
}

export function useCreateMutualFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMutualFundPayload) =>
      api<MutualFund>('/api/investments/mutual-funds', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
    },
  })
}

export function useUpdateMutualFund(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateMutualFundPayload) =>
      api<MutualFund>(`/api/investments/mutual-funds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
      qc.invalidateQueries({ queryKey: ['mutual-funds', id] })
    },
  })
}

export function useDeleteMutualFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/investments/mutual-funds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
    },
  })
}

// ----- gold ------------------------------------------------------------

export type GoldForm = 'bar' | 'coin' | 'digital' | 'jewelry'

export type CreateGoldPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  native_currency: string
  form: GoldForm
  purity: string
}

export type UpdateGoldPayload = {
  display_name: string
  description: string | null
  form: GoldForm
  purity: string
}

export function useGolds() {
  return useQuery({
    queryKey: ['golds'],
    queryFn: () => api<GoldListItem[]>('/api/investments/golds'),
    staleTime: 10_000,
  })
}

export function useGold(id: string | null) {
  return useQuery({
    queryKey: ['golds', id],
    queryFn: () => api<Gold>(`/api/investments/golds/${id}`),
    enabled: !!id,
  })
}

export function useCreateGold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateGoldPayload) =>
      api<Gold>('/api/investments/golds', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['golds'] })
    },
  })
}

export function useUpdateGold(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateGoldPayload) =>
      api<Gold>(`/api/investments/golds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['golds'] })
      qc.invalidateQueries({ queryKey: ['golds', id] })
    },
  })
}

export function useDeleteGold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/investments/golds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['golds'] })
    },
  })
}
