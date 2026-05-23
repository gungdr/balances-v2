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
import type { InvestmentTransaction, Disposition } from '@/api/types'
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

export function EditMaturityTransactionDialog<TResult>({
  open,
  onOpenChange,
  transaction,
  mutation,
}: Props<TResult>) {
  const [form, setForm] = useState({
    transaction_date: transaction.transaction_date.slice(0, 10),
    principal_amount: transaction.principal_amount ?? '',
    interest_amount: transaction.interest_amount ?? '',
    principal_disposition:
      (transaction.principal_disposition ?? 'cash_out') as Disposition,
    interest_disposition:
      (transaction.interest_disposition ?? 'cash_out') as Disposition,
    description: transaction.description ?? '',
  })

  const totalReceived = (() => {
    const p = Number(form.principal_amount)
    const i = Number(form.interest_amount)
    if (Number.isNaN(p) || Number.isNaN(i)) return null
    return (p + i).toString()
  })()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.principal_amount || !form.interest_amount) return
    mutation.mutate(
      {
        transactionId: transaction.id,
        payload: {
          transaction_date: form.transaction_date,
          currency: transaction.currency,
          description: form.description || null,
          amount: null,
          quantity: null,
          price_per_unit: null,
          principal_amount: form.principal_amount,
          interest_amount: form.interest_amount,
          principal_disposition: form.principal_disposition,
          interest_disposition: form.interest_disposition,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Maturity</DialogTitle>
          <DialogDescription>
            Adjust the principal, interest, dispositions, or description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_mat_date">Maturity date</Label>
            <Input
              id="edit_mat_date"
              type="date"
              required
              value={form.transaction_date}
              onChange={(e) =>
                setForm({ ...form, transaction_date: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_mat_principal">
                Principal ({transaction.currency})
              </Label>
              <Input
                id="edit_mat_principal"
                required
                inputMode="decimal"
                value={form.principal_amount}
                onChange={(e) =>
                  setForm({ ...form, principal_amount: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_mat_interest">
                Interest ({transaction.currency})
              </Label>
              <Input
                id="edit_mat_interest"
                required
                inputMode="decimal"
                value={form.interest_amount}
                onChange={(e) =>
                  setForm({ ...form, interest_amount: e.target.value })
                }
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total at maturity:</span>{' '}
            <span className="font-medium">
              {totalReceived !== null
                ? formatCurrency(totalReceived, transaction.currency)
                : '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_mat_principal_disp">
                Principal disposition
              </Label>
              <select
                id="edit_mat_principal_disp"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.principal_disposition}
                onChange={(e) =>
                  setForm({
                    ...form,
                    principal_disposition: e.target.value as Disposition,
                  })
                }
              >
                <option value="cash_out">Cash out</option>
                <option value="rolled_to_new">Rolled to new</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_mat_interest_disp">
                Interest disposition
              </Label>
              <select
                id="edit_mat_interest_disp"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.interest_disposition}
                onChange={(e) =>
                  setForm({
                    ...form,
                    interest_disposition: e.target.value as Disposition,
                  })
                }
              >
                <option value="cash_out">Cash out</option>
                <option value="rolled_to_new">Rolled to new</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_mat_description">
              Description (optional)
            </Label>
            <Input
              id="edit_mat_description"
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
                mutation.isPending ||
                !form.principal_amount ||
                !form.interest_amount
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
