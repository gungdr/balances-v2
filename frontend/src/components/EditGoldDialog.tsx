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
import { ApiError } from '@/api/client'
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
    form: g.details.form as GoldForm,
    purity: g.details.purity,
  }
}

export function EditGoldDialog({ open, onOpenChange, gold }: Props) {
  const mutation = useUpdateGold(gold.investment.id)
  const [form, setForm] = useState(() => toForm(gold))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
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
            Currency and ownership are not editable. Create a new position if
            those need to change.
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
