import { ApiError } from '@/api/client'

// Shared core for the bulk snapshot importer, group-agnostic. Every amount-shape
// position group (assets, liabilities, receivables) exposes the same backend
// endpoints under its own `{base}/import-template` + `{base}/import` — only the
// base path and the cache-invalidation differ, so those stay in the per-group
// hook files while the wire types + transport live here.

export type ImportRowError = { row: number; message: string }

export type ImportResult = {
  mode: 'preview' | 'commit'
  committed: boolean
  to_insert: number
  to_update: number
  errors: ImportRowError[]
}

export type ImportArgs = { file: File; mode: 'preview' | 'commit' }

// snapshotImportTemplateUrl is a plain GET the browser can hit as a download
// link; the session cookie rides along same-origin. `base` is the snapshots
// collection path, e.g. `/api/assets/{id}/snapshots`.
export function snapshotImportTemplateUrl(base: string): string {
  return `${base}/import-template`
}

// postSnapshotImport uploads multipart, so it bypasses the JSON `api` wrapper
// (which would force a Content-Type and clobber the multipart boundary). A 422
// is the "file had bad rows" outcome — its body is a valid ImportResult, so we
// return it rather than throwing, letting the dialog render the per-row errors.
export async function postSnapshotImport(
  base: string,
  file: File,
  mode: 'preview' | 'commit',
): Promise<ImportResult> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${base}/import?mode=${mode}`, {
    method: 'POST',
    body,
  })
  if (res.status === 422) return (await res.json()) as ImportResult
  if (!res.ok) {
    let errBody: unknown
    try {
      errBody = await res.json()
    } catch {
      errBody = await res.text().catch(() => undefined)
    }
    throw new ApiError(
      res.status,
      res.statusText || `import failed (${res.status})`,
      errBody,
    )
  }
  return (await res.json()) as ImportResult
}
