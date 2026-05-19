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
import { useCreateBankAccount } from '@/hooks/useBankAccounts'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'

const empty = {
  display_name: '',
  description: '',
  ownership_type: 'joint' as 'sole' | 'joint',
  native_currency: 'IDR',
  bank_name: '',
  account_number: '',
  account_type: 'savings' as 'savings' | 'current' | 'other',
}

export function CreateBankAccountDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const { data: user } = useSession()
  const mutation = useCreateBankAccount()

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
        // v1 simplification: sole = the current user. A user picker is
        // added later when M4 brings in a household-members endpoint.
        sole_owner_user_id: form.ownership_type === 'sole' ? user.id : null,
        native_currency: form.native_currency,
        bank_name: form.bank_name,
        account_number: form.account_number,
        account_type: form.account_type,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New bank account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bank account</DialogTitle>
          <DialogDescription>
            Track a bank account in your household. You'll record monthly
            balance snapshots from your bank statements afterwards.
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
              placeholder="BCA Savings"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bank_name">Bank name</Label>
            <Input
              id="bank_name"
              required
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="BCA"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account_number">Account number</Label>
            <Input
              id="account_number"
              required
              value={form.account_number}
              onChange={(e) =>
                setForm({ ...form, account_number: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="account_type">Account type</Label>
              <select
                id="account_type"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.account_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    account_type: e.target.value as typeof form.account_type,
                  })
                }
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
                <option value="other">Other</option>
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
                Mine
              </label>
            </div>
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
