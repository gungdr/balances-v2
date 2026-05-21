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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/api/client'
import { formatCurrency } from '@/lib/format'
import type { CreateInvestmentSnapshotPayload } from '@/hooks/useInvestmentSnapshots'

type Props<TResult> = {
  currency: string
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentSnapshotPayload
  >
}

function thisYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function emptyForm() {
  return {
    year_month: thisYearMonth(),
    amount: '',
    accrued_interest: '',
    as_of_date: '',
    description: '',
  }
}

// `amount` is the dirty total value (already includes accrued); the user
// types it as it appears on the statement. The derived "of which principal"
// line below = amount − accrued. The backend's validateInvestmentSnapshotShape
// re-checks both fields are present for bond/time_deposit subtypes.
function derivePrincipal(amount: string, accrued: string): string | null {
  const a = Number(amount)
  const i = Number(accrued)
  if (!amount || !accrued || Number.isNaN(a) || Number.isNaN(i)) {
    return null
  }
  return (a - i).toString()
}

export function CreateAccruedInterestSnapshotDialog<TResult>({
  currency,
  mutation,
}: Props<TResult>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const derivedPrincipal = derivePrincipal(form.amount, form.accrued_interest)

  function close() {
    setOpen(false)
    setForm(emptyForm())
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        year_month: form.year_month,
        amount: form.amount,
        currency,
        quantity: null,
        price_per_unit: null,
        accrued_interest: form.accrued_interest,
        as_of_date: form.as_of_date || null,
        description: form.description || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">+ New snapshot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record monthly snapshot</DialogTitle>
          <DialogDescription>
            Enter the month-end total value and the accrued interest
            component ({currency}). Total already includes accrued.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ai_year_month">Month</Label>
              <Input
                id="ai_year_month"
                type="month"
                required
                value={form.year_month}
                onChange={(e) =>
                  setForm({ ...form, year_month: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai_as_of_date">Statement date (optional)</Label>
              <Input
                id="ai_as_of_date"
                type="date"
                value={form.as_of_date}
                onChange={(e) =>
                  setForm({ ...form, as_of_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ai_amount">Total value ({currency})</Label>
              <Input
                id="ai_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="50250000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai_accrued">Accrued ({currency})</Label>
              <Input
                id="ai_accrued"
                required
                inputMode="decimal"
                value={form.accrued_interest}
                onChange={(e) =>
                  setForm({ ...form, accrued_interest: e.target.value })
                }
                placeholder="250000"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Of which principal:</span>{' '}
            <span className="font-medium">
              {derivedPrincipal !== null
                ? formatCurrency(derivedPrincipal, currency)
                : '—'}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai_description">Description (optional)</Label>
            <Input
              id="ai_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="from bank statement"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {formatError(mutation.error)}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save snapshot'}
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
