import { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
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
import { ApiError } from '@/api/client'
import { formatCurrency } from '@/lib/format'
import { todayDate } from '@/lib/dateLimits'
import type { UpdateInvestmentSnapshotPayload } from '@/hooks/useInvestmentSnapshots'

type AccruedInterestSnapshotLike = {
  id: string
  amount: string
  currency: string
  accrued_interest: string | null
  as_of_date: string | null
  description: string | null
}

export type UpdateAccruedInterestSnapshotMutationVariables = {
  snapshotId: string
  payload: UpdateInvestmentSnapshotPayload
}

type Props<TResult> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  snapshot: AccruedInterestSnapshotLike
  mutation: UseMutationResult<
    TResult,
    unknown,
    UpdateAccruedInterestSnapshotMutationVariables
  >
}

function derivePrincipal(amount: string, accrued: string): string | null {
  const a = Number(amount)
  const i = Number(accrued)
  if (!amount || !accrued || Number.isNaN(a) || Number.isNaN(i)) {
    return null
  }
  return (a - i).toString()
}

export function EditAccruedInterestSnapshotDialog<TResult>({
  open,
  onOpenChange,
  snapshot,
  mutation,
}: Props<TResult>) {
  const [form, setForm] = useState({
    amount: snapshot.amount,
    accrued_interest: snapshot.accrued_interest ?? '',
    as_of_date: snapshot.as_of_date ? snapshot.as_of_date.slice(0, 10) : '',
    description: snapshot.description ?? '',
  })

  const derivedPrincipal = derivePrincipal(form.amount, form.accrued_interest)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        snapshotId: snapshot.id,
        payload: {
          amount: form.amount,
          currency: snapshot.currency,
          quantity: null,
          price_per_unit: null,
          accrued_interest: form.accrued_interest,
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
            Update the total value, accrued, statement date, or description.
            To change the month, delete and re-create.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_ai_amount">
                Total value ({snapshot.currency})
              </Label>
              <Input
                id="edit_ai_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_ai_accrued">
                Accrued ({snapshot.currency})
              </Label>
              <Input
                id="edit_ai_accrued"
                required
                inputMode="decimal"
                value={form.accrued_interest}
                onChange={(e) =>
                  setForm({ ...form, accrued_interest: e.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Of which principal:</span>{' '}
            <span className="font-medium">
              {derivedPrincipal !== null
                ? formatCurrency(derivedPrincipal, snapshot.currency)
                : '—'}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_ai_as_of_date">
              Statement date (optional)
            </Label>
            <Input
              id="edit_ai_as_of_date"
              type="date"
              max={todayDate()}
              value={form.as_of_date}
              onChange={(e) =>
                setForm({ ...form, as_of_date: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_ai_description">
              Description (optional)
            </Label>
            <Input
              id="edit_ai_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {mutation.isError && (
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
