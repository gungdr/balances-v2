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
import { thisYearMonth, todayDate } from '@/lib/dateLimits'
import type { CreateInvestmentSnapshotPayload } from '@/hooks/useInvestmentSnapshots'

type Props<TResult> = {
  currency: string
  // Mutation is owned by the parent so the same dialog drives stocks,
  // mutual funds, and gold — each subtype's detail page wires its own
  // useCreateInvestmentSnapshot result in.
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentSnapshotPayload
  >
}

function emptyForm() {
  return {
    year_month: thisYearMonth(),
    quantity: '',
    price_per_unit: '',
    as_of_date: '',
    description: '',
  }
}

// amount = quantity × price_per_unit. The backend re-validates and stores
// amount alongside the two factors, so the UI sends both. Computed in
// JS with Number — household scale is fine; precision-sensitive arithmetic
// stays on the backend (decimal.Decimal).
function deriveAmount(quantity: string, pricePerUnit: string): string | null {
  const q = Number(quantity)
  const p = Number(pricePerUnit)
  if (!quantity || !pricePerUnit || Number.isNaN(q) || Number.isNaN(p)) {
    return null
  }
  return (q * p).toString()
}

export function CreateQuantityPriceSnapshotDialog<TResult>({
  currency,
  mutation,
}: Props<TResult>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const derivedAmount = deriveAmount(form.quantity, form.price_per_unit)

  function close() {
    setOpen(false)
    setForm(emptyForm())
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (derivedAmount === null) return
    mutation.mutate(
      {
        year_month: form.year_month,
        amount: derivedAmount,
        currency,
        quantity: form.quantity,
        price_per_unit: form.price_per_unit,
        accrued_interest: null,
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
            Enter the month-end quantity and price per unit. The total value
            is derived ({currency}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="inv_year_month">Month</Label>
              <Input
                id="inv_year_month"
                type="month"
                required
                max={thisYearMonth()}
                value={form.year_month}
                onChange={(e) =>
                  setForm({ ...form, year_month: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv_as_of_date">Statement date (optional)</Label>
              <Input
                id="inv_as_of_date"
                type="date"
                max={todayDate()}
                value={form.as_of_date}
                onChange={(e) =>
                  setForm({ ...form, as_of_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="inv_quantity">Quantity</Label>
              <Input
                id="inv_quantity"
                required
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="100"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv_price_per_unit">
                Price per unit ({currency})
              </Label>
              <Input
                id="inv_price_per_unit"
                required
                inputMode="decimal"
                value={form.price_per_unit}
                onChange={(e) =>
                  setForm({ ...form, price_per_unit: e.target.value })
                }
                placeholder="8500"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total value:</span>{' '}
            <span className="font-medium">
              {derivedAmount !== null
                ? formatCurrency(derivedAmount, currency)
                : '—'}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="inv_snap_description">Description (optional)</Label>
            <Input
              id="inv_snap_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="from broker statement"
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
            <Button
              type="submit"
              disabled={mutation.isPending || derivedAmount === null}
            >
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
