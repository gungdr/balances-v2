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
  mutation: UseMutationResult<
    TResult,
    unknown,
    UpdateTransactionMutationVariables
  >
}

const TITLES: Record<string, string> = {
  coupon: 'Coupon',
  dividend: 'Dividend',
  distribution: 'Distribution',
}

export function EditCashIncomeTransactionDialog<TResult>({
  open,
  onOpenChange,
  transaction,
  mutation,
}: Props<TResult>) {
  const [form, setForm] = useState({
    transaction_date: transaction.transaction_date.slice(0, 10),
    amount: transaction.amount ?? '',
    description: transaction.description ?? '',
  })

  const title = TITLES[transaction.transaction_type] ?? 'Income'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) return
    mutation.mutate(
      {
        transactionId: transaction.id,
        payload: {
          transaction_date: form.transaction_date,
          currency: transaction.currency,
          description: form.description || null,
          amount: form.amount,
          quantity: null,
          price_per_unit: null,
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
          <DialogTitle>Edit {title}</DialogTitle>
          <DialogDescription>
            Adjust the payment date, amount, or description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_cash_date">Payment date</Label>
              <Input
                id="edit_cash_date"
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
              <Label htmlFor="edit_cash_amount">
                Amount ({transaction.currency})
              </Label>
              <Input
                id="edit_cash_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_cash_description">
              Description (optional)
            </Label>
            <Input
              id="edit_cash_description"
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
            <Button type="submit" disabled={mutation.isPending || !form.amount}>
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
