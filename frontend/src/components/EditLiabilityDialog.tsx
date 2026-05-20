import { useEffect, useState } from 'react'
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
import { useUpdateLiability } from '@/hooks/useLiabilities'
import { ApiError } from '@/api/client'
import type { Liability } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  liability: Liability
}

function toForm(l: Liability) {
  return {
    display_name: l.display_name,
    description: l.description ?? '',
    counterparty_name: l.counterparty_name,
    principal: l.principal ?? '',
    interest_rate: l.interest_rate ?? '',
    term_months: l.term_months !== null ? String(l.term_months) : '',
    start_date: l.start_date ? l.start_date.slice(0, 10) : '',
    maturity_date: l.maturity_date ? l.maturity_date.slice(0, 10) : '',
  }
}

export function EditLiabilityDialog({ open, onOpenChange, liability }: Props) {
  const mutation = useUpdateLiability(liability.id)
  const [form, setForm] = useState(() => toForm(liability))

  // `mutation` is deliberately not in the deps array — see EditSnapshotDialog.
  useEffect(() => {
    if (open) setForm(toForm(liability))
  }, [open, liability])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        counterparty_name: form.counterparty_name,
        principal: form.principal || null,
        interest_rate: form.interest_rate || null,
        term_months: form.term_months ? Number(form.term_months) : null,
        start_date: form.start_date || null,
        maturity_date: form.maturity_date || null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit liability</DialogTitle>
          <DialogDescription>
            Subtype, currency, and ownership are not editable. Create a new
            liability if those need to change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_l_display_name">Display name</Label>
            <Input
              id="edit_l_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_l_counterparty">Counterparty</Label>
            <Input
              id="edit_l_counterparty"
              required
              value={form.counterparty_name}
              onChange={(e) =>
                setForm({ ...form, counterparty_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_l_principal">Principal (optional)</Label>
              <Input
                id="edit_l_principal"
                inputMode="decimal"
                value={form.principal}
                onChange={(e) =>
                  setForm({ ...form, principal: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_l_interest_rate">
                Interest rate (decimal, optional)
              </Label>
              <Input
                id="edit_l_interest_rate"
                inputMode="decimal"
                value={form.interest_rate}
                onChange={(e) =>
                  setForm({ ...form, interest_rate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_l_term">Term (months)</Label>
              <Input
                id="edit_l_term"
                inputMode="numeric"
                value={form.term_months}
                onChange={(e) =>
                  setForm({ ...form, term_months: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_l_start">Start</Label>
              <Input
                id="edit_l_start"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_l_maturity">Maturity</Label>
              <Input
                id="edit_l_maturity"
                type="date"
                value={form.maturity_date}
                onChange={(e) =>
                  setForm({ ...form, maturity_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_l_description">Description (optional)</Label>
            <Input
              id="edit_l_description"
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
