import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateSnapshot } from '@/hooks/useBankAccounts'
import { ApiError } from '@/api/client'
import type { AssetSnapshot } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  snapshot: AssetSnapshot
}

// year_month is not editable: changing it would mean creating a different
// month's snapshot, which conflicts with the (asset_id, year_month) unique
// constraint. To "move" a snapshot to a different month, delete and recreate.
export function EditSnapshotDialog({
  open,
  onOpenChange,
  assetId,
  snapshot,
}: Props) {
  const mutation = useUpdateSnapshot(assetId)

  const [form, setForm] = useState({
    amount: snapshot.amount,
    as_of_date: snapshot.as_of_date ? snapshot.as_of_date.slice(0, 10) : '',
    description: snapshot.description ?? '',
  })

  // See EditBankAccountDialog for why `mutation` is omitted from deps.
  useEffect(() => {
    if (open) {
      setForm({
        amount: snapshot.amount,
        as_of_date: snapshot.as_of_date ? snapshot.as_of_date.slice(0, 10) : '',
        description: snapshot.description ?? '',
      })
    }
  }, [open, snapshot])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        snapshotId: snapshot.id,
        payload: {
          amount: form.amount,
          currency: snapshot.currency,
          as_of_date: form.as_of_date || null,
          description: form.description || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit snapshot</DialogTitle>
          <DialogDescription>
            Update the amount, statement date, or description for this
            snapshot. To change the month, delete and re-create.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_amount">Amount ({snapshot.currency})</Label>
            <Input
              id="edit_amount"
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_as_of_date">Statement date (optional)</Label>
            <Input
              id="edit_as_of_date"
              type="date"
              value={form.as_of_date}
              onChange={(e) =>
                setForm({ ...form, as_of_date: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_snap_description">
              Description (optional)
            </Label>
            <Input
              id="edit_snap_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {mutation.error && (
            <p className="text-sm text-destructive">
              {formatError(mutation.error)}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
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
