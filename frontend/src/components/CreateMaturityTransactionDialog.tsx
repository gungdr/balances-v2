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
import type { Disposition, RolloverPolicy } from '@/api/types'

// Maturity shape (ADR-0009 §"Maturity transaction extension"). Records the
// principal + interest at maturity plus a disposition for each:
//   rolled_to_new — reinvested into a new instrument (a fresh row should
//     be created with the rolled-over amount; this dialog doesn't create
//     it automatically — see HANDOFF deferred items "duplicate matured TD")
//   cash_out      — paid out as cash (per ADR-0003 does NOT propagate to
//     bank-account snapshots; user sees it in the next bank statement)
//
// rolloverPolicy (when supplied — TD has it, Bond doesn't) drives the
// default dispositions. The user can override per event.
type Props<TResult> = {
  currency: string
  rolloverPolicy?: RolloverPolicy
  mutation: UseMutationResult<
    TResult,
    unknown,
    CreateInvestmentTransactionPayload
  >
}

function defaultsForPolicy(
  policy: RolloverPolicy | undefined,
): { principal: Disposition; interest: Disposition } {
  switch (policy) {
    case 'auto_renew_with_interest':
      return { principal: 'rolled_to_new', interest: 'rolled_to_new' }
    case 'auto_renew_principal':
      return { principal: 'rolled_to_new', interest: 'cash_out' }
    case 'no_rollover':
    default:
      return { principal: 'cash_out', interest: 'cash_out' }
  }
}

function emptyForm(policy?: RolloverPolicy) {
  const d = defaultsForPolicy(policy)
  return {
    transaction_date: todayDate(),
    principal_amount: '',
    interest_amount: '',
    principal_disposition: d.principal,
    interest_disposition: d.interest,
    description: '',
  }
}

export function CreateMaturityTransactionDialog<TResult>({
  currency,
  rolloverPolicy,
  mutation,
}: Props<TResult>) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => emptyForm(rolloverPolicy))

  const totalReceived = (() => {
    const p = Number(form.principal_amount)
    const i = Number(form.interest_amount)
    if (Number.isNaN(p) || Number.isNaN(i)) return null
    return (p + i).toString()
  })()

  function close() {
    setOpen(false)
    setForm(emptyForm(rolloverPolicy))
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.principal_amount || !form.interest_amount) return
    mutation.mutate(
      {
        transaction_type: 'maturity',
        transaction_date: form.transaction_date,
        currency,
        description: form.description || null,
        amount: null,
        quantity: null,
        price_per_unit: null,
        principal_amount: form.principal_amount,
        interest_amount: form.interest_amount,
        principal_disposition: form.principal_disposition,
        interest_disposition: form.interest_disposition,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          + Maturity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Maturity</DialogTitle>
          <DialogDescription>
            Position reached its scheduled end. Record principal, interest, and
            what happened to each. Rolled portions imply a fresh position
            record — create it separately if needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="mat_date">Maturity date</Label>
            <Input
              id="mat_date"
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
              <Label htmlFor="mat_principal">Principal ({currency})</Label>
              <Input
                id="mat_principal"
                required
                inputMode="decimal"
                value={form.principal_amount}
                onChange={(e) =>
                  setForm({ ...form, principal_amount: e.target.value })
                }
                placeholder="50000000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mat_interest">Interest ({currency})</Label>
              <Input
                id="mat_interest"
                required
                inputMode="decimal"
                value={form.interest_amount}
                onChange={(e) =>
                  setForm({ ...form, interest_amount: e.target.value })
                }
                placeholder="2750000"
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total at maturity:</span>{' '}
            <span className="font-medium">
              {totalReceived !== null
                ? formatCurrency(totalReceived, currency)
                : '—'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="mat_principal_disp">Principal disposition</Label>
              <select
                id="mat_principal_disp"
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
              <Label htmlFor="mat_interest_disp">Interest disposition</Label>
              <select
                id="mat_interest_disp"
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
            <Label htmlFor="mat_description">Description (optional)</Label>
            <Input
              id="mat_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="actual bank policy applied"
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
              disabled={
                mutation.isPending ||
                !form.principal_amount ||
                !form.interest_amount
              }
            >
              {mutation.isPending ? 'Saving…' : 'Record maturity'}
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
