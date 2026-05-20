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
import { useUpdateBankAccount } from '@/hooks/useBankAccounts'
import { ApiError } from '@/api/client'
import type { BankAccount } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: BankAccount
}

// EditBankAccountDialog is controlled by the caller (no DialogTrigger). The
// parent passes open/onOpenChange and the account row to pre-fill from.
export function EditBankAccountDialog({ open, onOpenChange, account }: Props) {
  const mutation = useUpdateBankAccount(account.asset.id)

  const [form, setForm] = useState({
    display_name: account.asset.display_name,
    description: account.asset.description ?? '',
    bank_name: account.details.bank_name,
    account_number: account.details.account_number,
    account_type: account.details.account_type,
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        bank_name: form.bank_name,
        account_number: form.account_number,
        account_type: form.account_type,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit bank account</DialogTitle>
          <DialogDescription>
            Update the account's display name, bank details, or description.
            Currency and ownership are not editable yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_display_name">Display name</Label>
            <Input
              id="edit_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_bank_name">Bank name</Label>
            <Input
              id="edit_bank_name"
              required
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_account_number">Account number</Label>
            <Input
              id="edit_account_number"
              required
              value={form.account_number}
              onChange={(e) =>
                setForm({ ...form, account_number: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_account_type">Account type</Label>
            <select
              id="edit_account_type"
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
            <Label htmlFor="edit_description">Description (optional)</Label>
            <Input
              id="edit_description"
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
