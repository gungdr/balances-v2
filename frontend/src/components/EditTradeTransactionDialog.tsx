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
import type { UpdateInvestmentTransactionPayload } from '@/hooks/useInvestmentTransactions'
import type { InvestmentTransaction } from '@/api/types'

export type UpdateTransactionMutationVariables = {
  transactionId: string
  payload: UpdateInvestmentTransactionPayload
}

type Props<TResult> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: InvestmentTransaction
  quantityUnit: string
  mutation: UseMutationResult<
    TResult,
    unknown,
    UpdateTransactionMutationVariables
  >
}

function deriveAmount(quantity: string, pricePerUnit: string): string | null {
  const q = Number(quantity)
  const p = Number(pricePerUnit)
  if (!quantity || !pricePerUnit || Number.isNaN(q) || Number.isNaN(p)) {
    return null
  }
  return (q * p).toString()
}

export function EditTradeTransactionDialog<TResult>({
  open,
  onOpenChange,
  transaction,
  quantityUnit,
  mutation,
}: Props<TResult>) {
  const [form, setForm] = useState({
    transaction_date: transaction.transaction_date.slice(0, 10),
    quantity: transaction.quantity ?? '',
    price_per_unit: transaction.price_per_unit ?? '',
    description: transaction.description ?? '',
  })

  const derivedAmount = deriveAmount(form.quantity, form.price_per_unit)
  const verb = transaction.transaction_type === 'buy' ? 'Buy' : 'Sell'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (derivedAmount === null) return
    mutation.mutate(
      {
        transactionId: transaction.id,
        payload: {
          transaction_date: form.transaction_date,
          currency: transaction.currency,
          description: form.description || null,
          amount: derivedAmount,
          quantity: form.quantity,
          price_per_unit: form.price_per_unit,
          principal_amount: null,
          interest_amount: null,
          principal_disposition: null,
          interest_disposition: null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {verb}</DialogTitle>
          <DialogDescription>
            Adjust the trade date, quantity, price, or description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_trade_date">Trade date</Label>
            <Input
              id="edit_trade_date"
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
              <Label htmlFor="edit_trade_quantity">
                Quantity ({quantityUnit})
              </Label>
              <Input
                id="edit_trade_quantity"
                required
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_trade_price">
                Price per unit ({transaction.currency})
              </Label>
              <Input
                id="edit_trade_price"
                required
                inputMode="decimal"
                value={form.price_per_unit}
                onChange={(e) =>
                  setForm({ ...form, price_per_unit: e.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {transaction.transaction_type === 'buy' ? 'Cash out:' : 'Cash in:'}
            </span>{' '}
            <span className="font-medium">
              {derivedAmount !== null
                ? formatCurrency(derivedAmount, transaction.currency)
                : '—'}
            </span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_trade_description">
              Description (optional)
            </Label>
            <Input
              id="edit_trade_description"
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
            <Button
              type="submit"
              disabled={mutation.isPending || derivedAmount === null}
            >
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
