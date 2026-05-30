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
import { useUpdateGold, type GoldForm } from '@/hooks/useInvestments'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'
import { RiskProfileSelect } from '@/components/RiskProfileSelect'
import type { Gold, GoldListItem } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gold: Gold | GoldListItem
}

function toForm(g: Gold | GoldListItem) {
  return {
    display_name: g.investment.display_name,
    description: g.investment.description ?? '',
    ownership_type: g.investment.ownership_type,
    sole_owner_user_id: g.investment.sole_owner_user_id,
    risk_profile: g.investment.risk_profile,
    form: g.details.form as GoldForm,
    purity: g.details.purity,
  }
}

export function EditGoldDialog({ open, onOpenChange, gold }: Props) {
  const mutation = useUpdateGold(gold.investment.id)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const [form, setForm] = useState(() => toForm(gold))

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
        form: form.form,
        purity: form.purity,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit gold</DialogTitle>
          <DialogDescription>
            Currency is not editable — create a new position if it needs to
            change. Ownership is editable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_gold_display_name">Display name</Label>
            <Input
              id="edit_gold_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_gold_form">Form</Label>
              <select
                id="edit_gold_form"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.form}
                onChange={(e) =>
                  setForm({ ...form, form: e.target.value as GoldForm })
                }
              >
                <option value="bar">Bar</option>
                <option value="coin">Coin</option>
                <option value="digital">Digital</option>
                <option value="jewelry">Jewelry</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_gold_purity">Purity (0–1)</Label>
              <Input
                id="edit_gold_purity"
                required
                inputMode="decimal"
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Ownership</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edit_gold_ownership_type"
                  value="joint"
                  checked={form.ownership_type === 'joint'}
                  onChange={() => setForm({ ...form, ownership_type: 'joint' })}
                />
                Joint
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edit_gold_ownership_type"
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
            <Label htmlFor="edit_gold_description">
              Description (optional)
            </Label>
            <Input
              id="edit_gold_description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          <RiskProfileSelect
            idPrefix="gold_edit"
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
