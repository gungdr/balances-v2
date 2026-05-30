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
import { todayDate } from '@/lib/dateLimits'
import type { CreateInvestmentTransactionPayload } from '@/hooks/useInvestmentTransactions'

// CashIncome shape covers Coupon (bond), Dividend (stock), Distribution
// (mutual fund). Cash received from the instrument; per ADR-0003 it does
// NOT propagate to bank-account snapshots (the user reads the resulting
// cash off the next bank statement).
type Props<TResult> = {
  currency: string
  txnType: 'coupon' | 'dividend' | 'distribution'
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentTransactionPayload
  >
}

function emptyForm() {
  return {
    transaction_date: todayDate(),
    amount: '',
    description: '',
  }
}

const TITLES: Record<Props<unknown>['txnType'], string> = {
  coupon: 'Coupon',
  dividend: 'Dividend',
  distribution: 'Distribution',
}

export function CreateCashIncomeTransactionDialog<TResult>({
  currency,
  txnType,
  mutation,
}: Props<TResult>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const title = TITLES[txnType]

  function close() {
    setOpen(false)
    setForm(emptyForm())
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) return
    mutation.mutate(
      {
        transaction_type: txnType,
        transaction_date: form.transaction_date,
        currency,
        description: form.description || null,
        amount: form.amount,
        quantity: null,
        price_per_unit: null,
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
        <Button size="sm" variant="outline">
          + {title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record {title}</DialogTitle>
          <DialogDescription>
            Cash payment received from the instrument. This will not update
            any bank balance — the cash appears in the next bank statement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cash_date">Payment date</Label>
              <Input
                id="cash_date"
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
              <Label htmlFor="cash_amount">Amount ({currency})</Label>
              <Input
                id="cash_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="50000"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cash_description">Description (optional)</Label>
            <Input
              id="cash_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Q1 2026 distribution"
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
            <Button type="submit" disabled={mutation.isPending || !form.amount}>
              {mutation.isPending ? 'Saving…' : `Record ${title.toLowerCase()}`}
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
