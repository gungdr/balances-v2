import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  Bond,
  RiskProfile,
  BondListItem,
  BondType,
  CouponFrequency,
  Gold,
  GoldListItem,
  MutualFund,
  MutualFundListItem,
  RolloverPolicy,
  Stock,
  StockListItem,
  TimeDeposit,
  TimeDepositListItem,
} from '@/api/types'

// ----- stock -----------------------------------------------------------

export type CreateStockPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
  native_currency: string
  ticker: string
  exchange: string
}

export type UpdateStockPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
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
  risk_profile: RiskProfile
  native_currency: string
  fund_code: string
  fund_manager: string | null
}

export type UpdateMutualFundPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
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
  risk_profile: RiskProfile
  native_currency: string
  form: GoldForm
  purity: string
}

export type UpdateGoldPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
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

// ----- bond ------------------------------------------------------------

export type CreateBondPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
  native_currency: string
  bond_type: BondType
  series_code: string | null
  issuer: string
  // face_value + placement_date seed the placement Buy for a govt_primary bond
  // (issue #27): nominal placed at par. Omitted for secondary_market, where the
  // user records the actual Buy. Required only for govt_primary.
  face_value: string
  placement_date: string
  coupon_rate: string
  coupon_frequency: CouponFrequency
  maturity_date: string
}

export type UpdateBondPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
  bond_type: BondType
  series_code: string | null
  issuer: string
  coupon_rate: string
  coupon_frequency: CouponFrequency
  maturity_date: string
}

export function useBonds() {
  return useQuery({
    queryKey: ['bonds'],
    queryFn: () => api<BondListItem[]>('/api/investments/bonds'),
    staleTime: 10_000,
  })
}

export function useBond(id: string | null) {
  return useQuery({
    queryKey: ['bonds', id],
    queryFn: () => api<Bond>(`/api/investments/bonds/${id}`),
    enabled: !!id,
  })
}

export function useCreateBond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateBondPayload) =>
      api<Bond>('/api/investments/bonds', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonds'] })
    },
  })
}

export function useUpdateBond(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateBondPayload) =>
      api<Bond>(`/api/investments/bonds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonds'] })
      qc.invalidateQueries({ queryKey: ['bonds', id] })
    },
  })
}

export function useDeleteBond() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/investments/bonds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonds'] })
    },
  })
}

// ----- time deposit ----------------------------------------------------

export type CreateTimeDepositPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
  native_currency: string
  bank_name: string
  principal: string
  interest_rate: string
  term_months: number
  placement_date: string
  maturity_date: string
  rollover_policy: RolloverPolicy
}

export type UpdateTimeDepositPayload = {
  display_name: string
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  risk_profile: RiskProfile
  bank_name: string
  principal: string
  interest_rate: string
  term_months: number
  placement_date: string
  maturity_date: string
  rollover_policy: RolloverPolicy
}

export function useTimeDeposits() {
  return useQuery({
    queryKey: ['time-deposits'],
    queryFn: () =>
      api<TimeDepositListItem[]>('/api/investments/time-deposits'),
    staleTime: 10_000,
  })
}

export function useTimeDeposit(id: string | null) {
  return useQuery({
    queryKey: ['time-deposits', id],
    queryFn: () =>
      api<TimeDeposit>(`/api/investments/time-deposits/${id}`),
    enabled: !!id,
  })
}

export function useCreateTimeDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTimeDepositPayload) =>
      api<TimeDeposit>('/api/investments/time-deposits', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-deposits'] })
    },
  })
}

export function useUpdateTimeDeposit(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTimeDepositPayload) =>
      api<TimeDeposit>(`/api/investments/time-deposits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-deposits'] })
      qc.invalidateQueries({ queryKey: ['time-deposits', id] })
    },
  })
}

export function useDeleteTimeDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/investments/time-deposits/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-deposits'] })
    },
  })
}
