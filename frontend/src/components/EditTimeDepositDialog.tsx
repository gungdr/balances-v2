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
import { useUpdateTimeDeposit } from '@/hooks/useInvestments'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'
import { RiskProfileSelect } from '@/components/RiskProfileSelect'
import type {
  RolloverPolicy,
  TimeDeposit,
  TimeDepositListItem,
} from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeDeposit: TimeDeposit | TimeDepositListItem
}

function toForm(td: TimeDeposit | TimeDepositListItem) {
  const i = td.investment
  const d = td.details
  return {
    display_name: i.display_name,
    description: i.description ?? '',
    ownership_type: i.ownership_type,
    sole_owner_user_id: i.sole_owner_user_id,
    risk_profile: td.investment.risk_profile,
    bank_name: d.bank_name,
    principal: d.principal,
    interest_rate: d.interest_rate,
    term_months: String(d.term_months),
    placement_date: d.placement_date ? d.placement_date.slice(0, 10) : '',
    maturity_date: d.maturity_date ? d.maturity_date.slice(0, 10) : '',
    rollover_policy: d.rollover_policy,
  }
}

export function EditTimeDepositDialog({
  open,
  onOpenChange,
  timeDeposit,
}: Props) {
  const [form, setForm] = useState(() => toForm(timeDeposit))
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useUpdateTimeDeposit(timeDeposit.investment.id)

  const effectiveSoleOwnerID = form.sole_owner_user_id ?? user?.id ?? null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        ownership_type: form.ownership_type,
        sole_owner_user_id:
          form.ownership_type === 'sole' ? effectiveSoleOwnerID : null,
        risk_profile: form.risk_profile,
        bank_name: form.bank_name,
        principal: form.principal,
        interest_rate: form.interest_rate,
        term_months: Number(form.term_months),
        placement_date: form.placement_date,
        maturity_date: form.maturity_date,
        rollover_policy: form.rollover_policy,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit time deposit</DialogTitle>
          <DialogDescription>
            Currency is fixed at creation. Ownership is editable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_td_display_name">Display name</Label>
              <Input
                id="edit_td_display_name"
                required
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_td_description">
                Description (optional)
              </Label>
              <Input
                id="edit_td_description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_td_bank_name">Bank name</Label>
              <Input
                id="edit_td_bank_name"
                required
                value={form.bank_name}
                onChange={(e) =>
                  setForm({ ...form, bank_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_td_principal">Principal</Label>
              <Input
                id="edit_td_principal"
                required
                inputMode="decimal"
                value={form.principal}
                onChange={(e) =>
                  setForm({ ...form, principal: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit_td_interest_rate">
                  Interest rate (% per year)
                </Label>
                <Input
                  id="edit_td_interest_rate"
                  required
                  inputMode="decimal"
                  value={form.interest_rate}
                  onChange={(e) =>
                    setForm({ ...form, interest_rate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_td_term_months">Term (months)</Label>
                <Input
                  id="edit_td_term_months"
                  required
                  inputMode="numeric"
                  value={form.term_months}
                  onChange={(e) =>
                    setForm({ ...form, term_months: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit_td_placement_date">Placement date</Label>
                <Input
                  id="edit_td_placement_date"
                  required
                  type="date"
                  value={form.placement_date}
                  onChange={(e) =>
                    setForm({ ...form, placement_date: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_td_maturity_date">Maturity date</Label>
                <Input
                  id="edit_td_maturity_date"
                  required
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) =>
                    setForm({ ...form, maturity_date: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_td_rollover_policy">At maturity</Label>
              <select
                id="edit_td_rollover_policy"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.rollover_policy}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rollover_policy: e.target.value as RolloverPolicy,
                  })
                }
              >
                <option value="auto_renew_principal">
                  Auto-renew principal
                </option>
                <option value="auto_renew_with_interest">
                  Auto-renew with interest
                </option>
                <option value="no_rollover">No rollover</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label>Ownership</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit_td_ownership_type"
                    value="joint"
                    checked={form.ownership_type === 'joint'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'joint' })
                    }
                  />
                  Joint
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit_td_ownership_type"
                    value="sole"
                    checked={form.ownership_type === 'sole'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'sole' })
                    }
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
          </div>

          <RiskProfileSelect
            idPrefix="td_edit"
            value={form.risk_profile}
            onChange={(v) => setForm({ ...form, risk_profile: v })}
          />

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
