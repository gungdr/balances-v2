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
import { useUpdateMutualFund } from '@/hooks/useInvestments'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'
import type { MutualFund, MutualFundListItem } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mutualFund: MutualFund | MutualFundListItem
}

function toForm(m: MutualFund | MutualFundListItem) {
  return {
    display_name: m.investment.display_name,
    description: m.investment.description ?? '',
    ownership_type: m.investment.ownership_type,
    sole_owner_user_id: m.investment.sole_owner_user_id,
    fund_code: m.details.fund_code,
    fund_manager: m.details.fund_manager ?? '',
  }
}

export function EditMutualFundDialog({
  open,
  onOpenChange,
  mutualFund,
}: Props) {
  const mutation = useUpdateMutualFund(mutualFund.investment.id)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const [form, setForm] = useState(() => toForm(mutualFund))

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
        fund_code: form.fund_code,
        fund_manager: form.fund_manager || null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit mutual fund</DialogTitle>
          <DialogDescription>
            Currency is not editable — create a new position if it needs to
            change. Ownership is editable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_mf_display_name">Display name</Label>
            <Input
              id="edit_mf_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_mf_fund_code">Fund code</Label>
              <Input
                id="edit_mf_fund_code"
                required
                value={form.fund_code}
                onChange={(e) =>
                  setForm({ ...form, fund_code: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_mf_fund_manager">
                Fund manager (optional)
              </Label>
              <Input
                id="edit_mf_fund_manager"
                value={form.fund_manager}
                onChange={(e) =>
                  setForm({ ...form, fund_manager: e.target.value })
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
                  name="edit_mf_ownership_type"
                  value="joint"
                  checked={form.ownership_type === 'joint'}
                  onChange={() => setForm({ ...form, ownership_type: 'joint' })}
                />
                Joint
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="edit_mf_ownership_type"
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
                    {m.display_name}
                    {user && m.id === user.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_mf_description">Description (optional)</Label>
            <Input
              id="edit_mf_description"
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
