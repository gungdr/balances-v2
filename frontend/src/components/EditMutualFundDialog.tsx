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
  const [form, setForm] = useState(() => toForm(mutualFund))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
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
            Currency and ownership are not editable. Create a new position if
            those need to change.
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
