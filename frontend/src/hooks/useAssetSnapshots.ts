import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { AssetSnapshot } from '@/api/types'

// Asset snapshots live under /api/assets/{id}/snapshots — shared across
// every asset subtype (bank_account, property, vehicle) since the snapshot
// shape and storage table are the same per ADR-0022.
//
// Mutations invalidate all three asset-type list queries because each
// list shows the latest snapshot inline; we don't know which subtype the
// affected asset belongs to without an extra lookup, and invalidating
// three small queries at household scale is cheaper than tracking that.

const ASSET_LIST_KEYS = [
  ['bank-accounts'],
  ['properties'],
  ['vehicles'],
] as const

function invalidateAssetLists(qc: ReturnType<typeof useQueryClient>) {
  ASSET_LIST_KEYS.forEach((key) =>
    qc.invalidateQueries({ queryKey: key as unknown as readonly unknown[] }),
  )
}

export type CreateSnapshotPayload = {
  year_month: string // "YYYY-MM" or "YYYY-MM-DD"
  amount: string
  currency: string
  as_of_date: string | null
  description: string | null
}

export type UpdateSnapshotPayload = {
  amount: string
  currency: string
  as_of_date: string | null
  description: string | null
}

export function useSnapshots(assetId: string | null) {
  return useQuery({
    queryKey: ['snapshots', assetId],
    queryFn: () =>
      api<AssetSnapshot[]>(`/api/assets/${assetId}/snapshots`),
    enabled: !!assetId,
  })
}

export function useCreateSnapshot(assetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSnapshotPayload) =>
      api<AssetSnapshot>(`/api/assets/${assetId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', assetId] })
      invalidateAssetLists(qc)
    },
  })
}

export function useUpdateSnapshot(assetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { snapshotId: string; payload: UpdateSnapshotPayload }) =>
      api<AssetSnapshot>(
        `/api/assets/${assetId}/snapshots/${args.snapshotId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(args.payload),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', assetId] })
      invalidateAssetLists(qc)
    },
  })
}

export function useDeleteSnapshot(assetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshotId: string) =>
      api(`/api/assets/${assetId}/snapshots/${snapshotId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots', assetId] })
      invalidateAssetLists(qc)
    },
  })
}
