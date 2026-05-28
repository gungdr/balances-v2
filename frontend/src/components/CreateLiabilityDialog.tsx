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
import { useCreateLiability } from '@/hooks/useLiabilities'
import { useSession } from '@/hooks/useSession'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { ApiError } from '@/api/client'

type Props = {
  // When the dialog opens from inside an inner-tab (Personal / Institutional),
  // the subtype is fixed by the tab — we pre-fill and hide the selector.
  defaultSubtype?: 'personal' | 'institutional'
}

function emptyForm(defaultSubtype: 'personal' | 'institutional') {
  return {
    display_name: '',
    description: '',
    subtype: defaultSubtype,
    ownership_type: 'joint' as 'sole' | 'joint',
    sole_owner_user_id: null as string | null,
    native_currency: 'IDR',
    counterparty_name: '',
    principal: '',
    interest_rate: '',
    term_months: '',
    start_date: '',
    maturity_date: '',
  }
}

export function CreateLiabilityDialog({ defaultSubtype = 'personal' }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm(defaultSubtype))
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateLiability()

  const effectiveSoleOwnerID = form.sole_owner_user_id ?? user?.id ?? null

  function close() {
    setOpen(false)
    setForm(emptyForm(defaultSubtype))
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        subtype: form.subtype,
        ownership_type: form.ownership_type,
        sole_owner_user_id:
          form.ownership_type === 'sole' ? effectiveSoleOwnerID : null,
        native_currency: form.native_currency,
        counterparty_name: form.counterparty_name,
        principal: form.principal || null,
        interest_rate: form.interest_rate || null,
        term_months: form.term_months ? Number(form.term_months) : null,
        start_date: form.start_date || null,
        maturity_date: form.maturity_date || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New liability</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New liability</DialogTitle>
          <DialogDescription>
            Track a debt your household owes. Personal liabilities are informal
            (family, friends); institutional are formal (mortgage, bank loan,
            credit-card balance).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
              placeholder="BCA KPR"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="subtype">Subtype</Label>
              <select
                id="subtype"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.subtype}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subtype: e.target.value as 'personal' | 'institutional',
                  })
                }
              >
                <option value="personal">Personal</option>
                <option value="institutional">Institutional</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="native_currency">Currency</Label>
              <Input
                id="native_currency"
                required
                value={form.native_currency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    native_currency: e.target.value.toUpperCase(),
                  })
                }
                placeholder="IDR"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="counterparty_name">Counterparty</Label>
            <Input
              id="counterparty_name"
              required
              value={form.counterparty_name}
              onChange={(e) =>
                setForm({ ...form, counterparty_name: e.target.value })
              }
              placeholder="Bank BCA / John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="principal">Principal (optional)</Label>
              <Input
                id="principal"
                inputMode="decimal"
                value={form.principal}
                onChange={(e) =>
                  setForm({ ...form, principal: e.target.value })
                }
                placeholder="1500000000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="interest_rate">
                Interest rate (% per year, optional)
              </Label>
              <Input
                id="interest_rate"
                inputMode="decimal"
                value={form.interest_rate}
                onChange={(e) =>
                  setForm({ ...form, interest_rate: e.target.value })
                }
                placeholder="0.08 = 8% /yr"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="term_months">Term (months, opt.)</Label>
              <Input
                id="term_months"
                inputMode="numeric"
                value={form.term_months}
                onChange={(e) =>
                  setForm({ ...form, term_months: e.target.value })
                }
                placeholder="180"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="start_date">Start (optional)</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maturity_date">Maturity (optional)</Label>
              <Input
                id="maturity_date"
                type="date"
                value={form.maturity_date}
                onChange={(e) =>
                  setForm({ ...form, maturity_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Ownership</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ownership_type"
                  value="joint"
                  checked={form.ownership_type === 'joint'}
                  onChange={() => setForm({ ...form, ownership_type: 'joint' })}
                />
                Joint
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ownership_type"
                  value="sole"
                  checked={form.ownership_type === 'sole'}
                  onChange={() => setForm({ ...form, ownership_type: 'sole' })}
                />
                Sole owner
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

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
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
              {mutation.isPending ? 'Creating…' : 'Create'}
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
