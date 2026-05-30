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
import { todayDate } from '@/lib/dateLimits'
import type { CreateInvestmentTransactionPayload } from '@/hooks/useInvestmentTransactions'

// Trade shape covers Buy + Sell. The type is fixed by the caller —
// each detail page wires a "+ Buy" and "+ Sell" button passing
// txnType: 'buy' | 'sell'.
type Props<TResult> = {
  currency: string
  txnType: 'buy' | 'sell'
  quantityUnit: string // "sh", "units", "g", etc.
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentTransactionPayload
  >
}

function emptyForm() {
  return {
    transaction_date: todayDate(),
    quantity: '',
    price_per_unit: '',
    description: '',
  }
}

function deriveAmount(quantity: string, pricePerUnit: string): string | null {
  const q = Number(quantity)
  const p = Number(pricePerUnit)
  if (!quantity || !pricePerUnit || Number.isNaN(q) || Number.isNaN(p)) {
    return null
  }
  return (q * p).toString()
}

export function CreateTradeTransactionDialog<TResult>({
  currency,
  txnType,
  quantityUnit,
  mutation,
}: Props<TResult>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const derivedAmount = deriveAmount(form.quantity, form.price_per_unit)
  const verb = txnType === 'buy' ? 'Buy' : 'Sell'

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
        transaction_type: txnType,
        transaction_date: form.transaction_date,
        currency,
        description: form.description || null,
        amount: derivedAmount,
        quantity: form.quantity,
        price_per_unit: form.price_per_unit,
        principal_amount: null,
        interest_amount: null,
        principal_disposition: null,
        interest_disposition: null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant={txnType === 'buy' ? 'default' : 'outline'}>
          + {verb}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record {verb}</DialogTitle>
          <DialogDescription>
            {txnType === 'buy'
              ? `Quantity acquired and the price paid per unit. Total cash out is derived (${currency}).`
              : `Quantity sold and the price received per unit. Total cash in is derived (${currency}).`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="trade_date">Trade date</Label>
            <Input
              id="trade_date"
              type="date"
              required
              max={todayDate()}
              value={form.transaction_date}
              onChange={(e) =>
                setForm({ ...form, transaction_date: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="trade_quantity">Quantity ({quantityUnit})</Label>
              <Input
                id="trade_quantity"
                required
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="100"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trade_price">Price per unit ({currency})</Label>
              <Input
                id="trade_price"
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
            <span className="text-muted-foreground">
              {txnType === 'buy' ? 'Cash out:' : 'Cash in:'}
            </span>{' '}
            <span className="font-medium">
              {derivedAmount !== null
                ? formatCurrency(derivedAmount, currency)
                : '—'}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="trade_description">Description (optional)</Label>
            <Input
              id="trade_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="from broker confirmation"
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
              {mutation.isPending ? 'Saving…' : `Record ${verb.toLowerCase()}`}
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
