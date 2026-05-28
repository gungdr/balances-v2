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
import { useCreateReceivable } from '@/hooks/useReceivables'
import { useSession } from '@/hooks/useSession'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { ApiError } from '@/api/client'

const empty = {
  display_name: '',
  description: '',
  ownership_type: 'joint' as 'sole' | 'joint',
  sole_owner_user_id: null as string | null,
  native_currency: 'IDR',
  counterparty_name: '',
  due_date: '',
}

export function CreateReceivableDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateReceivable()

  const effectiveSoleOwnerID = form.sole_owner_user_id ?? user?.id ?? null

  function close() {
    setOpen(false)
    setForm(empty)
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        ownership_type: form.ownership_type,
        sole_owner_user_id:
          form.ownership_type === 'sole' ? effectiveSoleOwnerID : null,
        native_currency: form.native_currency,
        counterparty_name: form.counterparty_name,
        due_date: form.due_date || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New receivable</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New receivable</DialogTitle>
          <DialogDescription>
            Track money owed to your household — loans you've made, deposits
            you're due back, refunds in transit.
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
              placeholder="Loan to brother"
            />
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
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid gap-2">
              <Label htmlFor="due_date">Due date (optional)</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
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
