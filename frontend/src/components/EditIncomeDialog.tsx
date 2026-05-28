import { useState } from 'react'
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
import { useUpdateIncome } from '@/hooks/useIncome'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'
import type { Income, IncomeCategory } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  income: Income
}

function toForm(i: Income) {
  return {
    date: i.date.slice(0, 10),
    amount: i.amount,
    currency: i.currency,
    category: i.category,
    description: i.description ?? '',
    ownership_type: i.ownership_type,
    sole_owner_user_id: i.sole_owner_user_id,
  }
}

export function EditIncomeDialog({ open, onOpenChange, income }: Props) {
  const mutation = useUpdateIncome(income.id)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const [form, setForm] = useState(() => toForm(income))

  // If the original row had no sole_owner (was joint, now flipped to sole),
  // fall back to the current user.
  const effectiveSoleOwnerID =
    form.sole_owner_user_id ?? user?.id ?? null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    mutation.mutate(
      {
        date: form.date,
        amount: form.amount,
        currency: form.currency,
        category: form.category,
        description: form.description || null,
        ownership_type: form.ownership_type,
        sole_owner_user_id:
          form.ownership_type === 'sole' ? effectiveSoleOwnerID : null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit income</DialogTitle>
          <DialogDescription>
            Corrections retroactively shift the income statement for the
            affected month.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_income_date">Date</Label>
              <Input
                id="edit_income_date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_income_category">Category</Label>
              <select
                id="edit_income_category"
                required
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as IncomeCategory,
                  })
                }
              >
                <option value="salary">Salary</option>
                <option value="business_income">Business income</option>
                <option value="rental_income">Rental income</option>
                <option value="gift">Gift</option>
                <option value="tax_refund">Tax refund</option>
                <option value="insurance_payout">Insurance payout</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_income_amount">Amount</Label>
              <Input
                id="edit_income_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_income_currency">Currency</Label>
              <Input
                id="edit_income_currency"
                required
                value={form.currency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currency: e.target.value.toUpperCase(),
                  })
                }
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_income_description">
              Description (optional)
            </Label>
            <Input
              id="edit_income_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label>Ownership</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edit_ownership_type"
                  value="sole"
                  checked={form.ownership_type === 'sole'}
                  onChange={() =>
                    setForm({ ...form, ownership_type: 'sole' })
                  }
                />
                Sole owner
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edit_ownership_type"
                  value="joint"
                  checked={form.ownership_type === 'joint'}
                  onChange={() =>
                    setForm({ ...form, ownership_type: 'joint' })
                  }
                />
                Joint
              </label>
            </div>
            {form.ownership_type === 'sole' && (
              <select
                aria-label="Sole owner"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={effectiveSoleOwnerID ?? ''}
                onChange={(e) =>
                  setForm({ ...form, sole_owner_user_id: e.target.value })
                }
              >
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {preferredName(m)}
                    {user && m.id === user.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {mutation.error && (
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
