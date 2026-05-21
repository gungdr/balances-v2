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
import { useUpdateStock } from '@/hooks/useInvestments'
import { ApiError } from '@/api/client'
import type { Stock, StockListItem } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Accepts either the detail-page Stock or a list-row StockListItem so
  // both call sites can pass what they already have.
  stock: Stock | StockListItem
}

function toForm(s: Stock | StockListItem) {
  return {
    display_name: s.investment.display_name,
    description: s.investment.description ?? '',
    ticker: s.details.ticker,
    exchange: s.details.exchange,
  }
}

export function EditStockDialog({ open, onOpenChange, stock }: Props) {
  const mutation = useUpdateStock(stock.investment.id)
  const [form, setForm] = useState(() => toForm(stock))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        ticker: form.ticker.toUpperCase(),
        exchange: form.exchange.toUpperCase(),
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit stock</DialogTitle>
          <DialogDescription>
            Currency and ownership are not editable. Create a new position if
            those need to change.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_stock_display_name">Display name</Label>
            <Input
              id="edit_stock_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_stock_ticker">Ticker</Label>
              <Input
                id="edit_stock_ticker"
                required
                value={form.ticker}
                onChange={(e) =>
                  setForm({ ...form, ticker: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_stock_exchange">Exchange</Label>
              <Input
                id="edit_stock_exchange"
                required
                value={form.exchange}
                onChange={(e) =>
                  setForm({ ...form, exchange: e.target.value.toUpperCase() })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_stock_description">
              Description (optional)
            </Label>
            <Input
              id="edit_stock_description"
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
