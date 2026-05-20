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
import { useUpdateReceivable } from '@/hooks/useReceivables'
import { ApiError } from '@/api/client'
import type { Receivable } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  receivable: Receivable
}

function toForm(r: Receivable) {
  return {
    display_name: r.display_name,
    description: r.description ?? '',
    counterparty_name: r.counterparty_name,
    due_date: r.due_date ? r.due_date.slice(0, 10) : '',
  }
}

export function EditReceivableDialog({
  open,
  onOpenChange,
  receivable,
}: Props) {
  const mutation = useUpdateReceivable(receivable.id)
  const [form, setForm] = useState(() => toForm(receivable))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        counterparty_name: form.counterparty_name,
        due_date: form.due_date || null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit receivable</DialogTitle>
          <DialogDescription>
            Currency and ownership are not editable. Create a new receivable
            if those need to change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_r_display_name">Display name</Label>
            <Input
              id="edit_r_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_r_counterparty">Counterparty</Label>
            <Input
              id="edit_r_counterparty"
              required
              value={form.counterparty_name}
              onChange={(e) =>
                setForm({ ...form, counterparty_name: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_r_due_date">Due date (optional)</Label>
            <Input
              id="edit_r_due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_r_description">Description (optional)</Label>
            <Input
              id="edit_r_description"
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
