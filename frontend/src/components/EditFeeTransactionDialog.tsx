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
import { todayDate } from '@/lib/dateLimits'
import type { InvestmentTransaction } from '@/api/types'
import type { UpdateTransactionMutationVariables } from '@/components/EditTradeTransactionDialog'

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

export function EditFeeTransactionDialog<TResult>({
  open,
  onOpenChange,
  transaction,
  quantityUnit,
  mutation,
}: Props<TResult>) {
  const [form, setForm] = useState({
    transaction_date: transaction.transaction_date.slice(0, 10),
    amount: transaction.amount ?? '',
    quantity: transaction.quantity ?? '',
    price_per_unit: transaction.price_per_unit ?? '',
    description: transaction.description ?? '',
  })

  const hasQty = !!form.quantity
  const hasPrice = !!form.price_per_unit
  const unitFeeIncomplete = hasQty !== hasPrice

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || unitFeeIncomplete) return
    mutation.mutate(
      {
        transactionId: transaction.id,
        payload: {
          transaction_date: form.transaction_date,
          currency: transaction.currency,
          description: form.description || null,
          amount: form.amount,
          quantity: form.quantity || null,
          price_per_unit: form.price_per_unit || null,
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
          <DialogTitle>Edit Fee</DialogTitle>
          <DialogDescription>
            Adjust the fee date, amount, deducted units, or description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_fee_date">Fee date</Label>
              <Input
                id="edit_fee_date"
                type="date"
                required
                max={todayDate()}
                value={form.transaction_date}
                onChange={(e) =>
                  setForm({ ...form, transaction_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_fee_amount">
                Cash amount ({transaction.currency})
              </Label>
              <Input
                id="edit_fee_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_fee_quantity">
                Units deducted ({quantityUnit}, optional)
              </Label>
              <Input
                id="edit_fee_quantity"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_fee_price">
                Conversion price ({transaction.currency}, optional)
              </Label>
              <Input
                id="edit_fee_price"
                inputMode="decimal"
                value={form.price_per_unit}
                onChange={(e) =>
                  setForm({ ...form, price_per_unit: e.target.value })
                }
              />
            </div>
          </div>

          {unitFeeIncomplete && (
            <p className="text-xs text-amber-600">
              If recording a unit-settled fee, fill in both quantity and price.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="edit_fee_description">
              Description (optional)
            </Label>
            <Input
              id="edit_fee_description"
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
              disabled={
                mutation.isPending || !form.amount || unitFeeIncomplete
              }
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
