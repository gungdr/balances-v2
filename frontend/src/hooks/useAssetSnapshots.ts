import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api/client'
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

// ----- bulk snapshot import (xlsx template) -------------------------------

export type ImportRowError = { row: number; message: string }

export type ImportResult = {
  mode: 'preview' | 'commit'
  committed: boolean
  to_insert: number
  to_update: number
  errors: ImportRowError[]
}

// importTemplateUrl is a plain GET the browser can hit as a download link;
// the session cookie rides along same-origin.
export function importTemplateUrl(assetId: string): string {
  return `/api/assets/${assetId}/snapshots/import-template`
}

// postImport uploads multipart, so it bypasses the JSON `api` wrapper (which
// would force a Content-Type and clobber the multipart boundary). A 422 is the
// "file had bad rows" outcome — its body is a valid ImportResult, so we return
// it rather than throwing, letting the dialog render the per-row errors.
async function postImport(
  assetId: string,
  file: File,
  mode: 'preview' | 'commit',
): Promise<ImportResult> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(
    `/api/assets/${assetId}/snapshots/import?mode=${mode}`,
    { method: 'POST', body },
  )
  if (res.status === 422) return (await res.json()) as ImportResult
  if (!res.ok) {
    let errBody: unknown
    try {
      errBody = await res.json()
    } catch {
      errBody = await res.text().catch(() => undefined)
    }
    throw new ApiError(res.status, res.statusText || `import failed (${res.status})`, errBody)
  }
  return (await res.json()) as ImportResult
}

export function useImportSnapshots(assetId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { file: File; mode: 'preview' | 'commit' }) =>
      postImport(assetId, args.file, args.mode),
    onSuccess: (result) => {
      // Only a real write should refresh the snapshot/list caches; a preview
      // changed nothing. (The global MutationCache still pokes ['reports'],
      // which is a harmless no-op refetch when nothing was committed.)
      if (result.committed) {
        qc.invalidateQueries({ queryKey: ['snapshots', assetId] })
        invalidateAssetLists(qc)
      }
    },
  })
}
