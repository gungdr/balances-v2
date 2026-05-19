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
import { useCreateSnapshot } from '@/hooks/useBankAccounts'
import { ApiError } from '@/api/client'

type Props = {
  assetId: string
  currency: string
}

// Default to the current month in YYYY-MM form.
function thisYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function CreateSnapshotDialog({ assetId, currency }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    year_month: thisYearMonth(),
    amount: '',
    as_of_date: '',
    description: '',
  })
  const mutation = useCreateSnapshot(assetId)

  function close() {
    setOpen(false)
    setForm({
      year_month: thisYearMonth(),
      amount: '',
      as_of_date: '',
      description: '',
    })
    mutation.reset()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        year_month: form.year_month,
        amount: form.amount,
        currency,
        as_of_date: form.as_of_date || null,
        description: form.description || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">+ New snapshot</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record monthly balance</DialogTitle>
          <DialogDescription>
            Enter the month-end balance for this account. Currency is locked
            to the account's native currency ({currency}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="year_month">Month</Label>
              <Input
                id="year_month"
                type="month"
                required
                value={form.year_month}
                onChange={(e) =>
                  setForm({ ...form, year_month: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="as_of_date">Statement date (optional)</Label>
              <Input
                id="as_of_date"
                type="date"
                value={form.as_of_date}
                onChange={(e) =>
                  setForm({ ...form, as_of_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 12500000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="from BCA statement"
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
              {mutation.isPending ? 'Saving…' : 'Save snapshot'}
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
