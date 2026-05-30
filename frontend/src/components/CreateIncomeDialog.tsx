import { useState } from 'react'
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
import { useCreateIncome } from '@/hooks/useIncome'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'
import type { IncomeCategory, Regularity } from '@/api/types'

// todayISO returns YYYY-MM-DD in the local timezone. toISOString() would shift
// users east of UTC into yesterday for the first hours of their day.
function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type FormState = {
  date: string
  amount: string
  currency: string
  category: IncomeCategory | ''
  description: string
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  regularity: Regularity
}

export type DuplicateSeed = {
  amount: string
  currency: string
  category: IncomeCategory
  description: string | null
  ownership_type: 'sole' | 'joint'
  sole_owner_user_id: string | null
  regularity: Regularity
}

type Props = {
  /** Controlled mode. If provided, parent owns open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Pre-fill from an existing row (Duplicate flow). Parent must remount the
   *  dialog (key={seedId}) when seed changes — initial state comes from the
   *  useState initializer, not a useEffect. */
  seed?: DuplicateSeed
  /** Suppress the default "+ New income" trigger button. */
  hideTrigger?: boolean
}

function initialForm(seed?: DuplicateSeed): FormState {
  if (!seed) {
    return {
      date: todayISO(),
      amount: '',
      currency: 'IDR',
      category: '',
      description: '',
      ownership_type: 'sole',
      sole_owner_user_id: null,
      // Default routine: salary-dominant case (M4.5 grilling lineage).
      regularity: 'routine',
    }
  }
  return {
    date: todayISO(),
    amount: seed.amount,
    currency: seed.currency,
    category: seed.category,
    description: seed.description ?? '',
    ownership_type: seed.ownership_type,
    sole_owner_user_id: seed.sole_owner_user_id,
    regularity: seed.regularity,
  }
}

export function CreateIncomeDialog({
  open: controlledOpen,
  onOpenChange,
  seed,
  hideTrigger = false,
}: Props = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const [form, setForm] = useState<FormState>(() => initialForm(seed))
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateIncome()

  // Default the sole-owner picker to the current user the first time we know
  // who they are. If a seed pre-fills sole_owner_user_id, that takes priority.
  const effectiveSoleOwnerID =
    form.sole_owner_user_id ?? user?.id ?? null

  function close() {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setUncontrolledOpen(false)
      setForm(initialForm(seed))
    }
    mutation.reset()
  }

  function openDialog() {
    if (isControlled) {
      onOpenChange?.(true)
    } else {
      setUncontrolledOpen(true)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.category) return
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
        regularity: form.regularity,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? openDialog() : close())}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>+ New income</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{seed ? 'Duplicate income' : 'New income'}</DialogTitle>
          <DialogDescription>
            {seed
              ? 'Pre-filled from the original. Date defaults to today.'
              : 'Record earned cash entering your household — salary, gifts, refunds, payouts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="income_date">Date</Label>
              <Input
                id="income_date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="income_category">Category</Label>
              <select
                id="income_category"
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
                <option value="" disabled>
                  Select category
                </option>
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
              <Label htmlFor="income_amount">Amount</Label>
              <Input
                id="income_amount"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="15000000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="income_currency">Currency</Label>
              <Input
                id="income_currency"
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
            <Label htmlFor="income_description">Description (optional)</Label>
            <Input
              id="income_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Base salary"
            />
          </div>

          <div className="grid gap-2">
            <Label>Regularity</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="regularity"
                  value="routine"
                  checked={form.regularity === 'routine'}
                  onChange={() => setForm({ ...form, regularity: 'routine' })}
                />
                Routine
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="regularity"
                  value="incidental"
                  checked={form.regularity === 'incidental'}
                  onChange={() =>
                    setForm({ ...form, regularity: 'incidental' })
                  }
                />
                Incidental
              </label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Ownership</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ownership_type"
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
                  name="ownership_type"
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
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Create'}
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
