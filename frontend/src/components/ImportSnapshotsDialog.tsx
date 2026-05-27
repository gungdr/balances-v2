import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/api/client'
import {
  importTemplateUrl,
  useImportSnapshots,
  type ImportResult,
} from '@/hooks/useAssetSnapshots'

type Props = {
  assetId: string
  currency: string
}

// Two-step bulk import: download a scoped template, fill it offline, then
// upload. "Check file" runs a server-side dry-run (validates + counts, writes
// nothing); "Import" only lights up once the file is clean. Aimed at a
// non-technical user backfilling years of statements at once.
export function ImportSnapshotsDialog({ assetId, currency }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mutation = useImportSnapshots(assetId)

  function reset() {
    setFile(null)
    setResult(null)
    mutation.reset()
    if (fileRef.current) fileRef.current.value = ''
  }
  function close() {
    setOpen(false)
    reset()
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setResult(null)
    mutation.reset()
  }

  function run(mode: 'preview' | 'commit') {
    if (!file) return
    mutation.mutate({ file, mode }, { onSuccess: setResult })
  }

  const total = result ? result.to_insert + result.to_update : 0
  const cleanPreview =
    result?.mode === 'preview' && result.errors.length === 0 && total > 0
  const emptyPreview =
    result?.mode === 'preview' && result.errors.length === 0 && total === 0
  const committed = result?.committed === true

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="import-snapshots-trigger">
          Import from spreadsheet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import snapshots</DialogTitle>
          <DialogDescription>
            Bulk-add monthly balances from a spreadsheet — handy for backfilling
            years of history at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label>1. Download the template</Label>
            <a
              href={importTemplateUrl(assetId)}
              className="text-sm text-primary underline underline-offset-4"
              data-testid="import-template-link"
            >
              Download template (.xlsx)
            </a>
            <p className="text-xs text-muted-foreground">
              Fill one row per month-end balance (currency defaults to{' '}
              {currency}). Open it in Google Sheets, LibreOffice, Numbers, or
              Excel; save as <strong>.xlsx</strong> (not CSV). You only need the
              months you actually have a figure for.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="import-file">2. Upload the filled-in file</Label>
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onPickFile}
              className="text-sm"
              data-testid="import-file-input"
            />
          </div>

          {result && !committed && (
            <div className="text-sm" data-testid="import-result">
              {result.errors.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-destructive">
                    {result.errors.length} row
                    {result.errors.length === 1 ? '' : 's'} need fixing — nothing
                    was imported:
                  </p>
                  <ul
                    className="list-disc space-y-0.5 pl-5 text-destructive"
                    data-testid="import-errors"
                  >
                    {result.errors.map((e) => (
                      <li key={e.row}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : emptyPreview ? (
                <p className="text-muted-foreground">
                  No rows found in the file. Add some balances and re-upload.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Ready: <strong>{result.to_insert}</strong> new,{' '}
                  <strong>{result.to_update}</strong> updated. Nothing saved yet
                  — press Import to confirm.
                </p>
              )}
            </div>
          )}

          {committed && (
            <p className="text-sm text-emerald-600" data-testid="import-done">
              Imported {result.to_insert} new + {result.to_update} updated
              month{total === 1 ? '' : 's'}.
            </p>
          )}

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {formatError(mutation.error)}
            </p>
          )}
        </div>

        <DialogFooter>
          {committed ? (
            <Button type="button" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!file || mutation.isPending}
                onClick={() => run('preview')}
                data-testid="import-check-btn"
              >
                {mutation.isPending && !committed ? 'Checking…' : 'Check file'}
              </Button>
              <Button
                type="button"
                disabled={!cleanPreview || mutation.isPending}
                onClick={() => run('commit')}
                data-testid="import-commit-btn"
              >
                {cleanPreview ? `Import ${total} month${total === 1 ? '' : 's'}` : 'Import'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (typeof err.body === 'string' && err.body) return err.body
    return `${err.status} ${err.message}`
  }
  if (err instanceof Error) return err.message
  return 'unknown error'
}
