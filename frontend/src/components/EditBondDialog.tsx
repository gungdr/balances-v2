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
import { useUpdateBond } from '@/hooks/useInvestments'
import { ApiError } from '@/api/client'
import type {
  Bond,
  BondListItem,
  BondType,
  CouponFrequency,
} from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bond: Bond | BondListItem
}

function toForm(bond: Bond | BondListItem) {
  const i = bond.investment
  const d = bond.details
  return {
    display_name: i.display_name,
    description: i.description ?? '',
    bond_type: d.bond_type,
    series_code: d.series_code ?? '',
    issuer: d.issuer,
    face_value: d.face_value,
    coupon_rate: d.coupon_rate,
    coupon_frequency: d.coupon_frequency,
    maturity_date: d.maturity_date ? d.maturity_date.slice(0, 10) : '',
  }
}

export function EditBondDialog({ open, onOpenChange, bond }: Props) {
  const [form, setForm] = useState(() => toForm(bond))
  const mutation = useUpdateBond(bond.investment.id)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        bond_type: form.bond_type,
        series_code: form.series_code.trim() || null,
        issuer: form.issuer,
        face_value: form.face_value,
        coupon_rate: form.coupon_rate,
        coupon_frequency: form.coupon_frequency,
        maturity_date: form.maturity_date,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit bond</DialogTitle>
          <DialogDescription>
            Ownership and currency are fixed at creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_bond_display_name">Display name</Label>
              <Input
                id="edit_bond_display_name"
                required
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_series_code">
                  Series code (optional)
                </Label>
                <Input
                  id="edit_bond_series_code"
                  value={form.series_code}
                  onChange={(e) =>
                    setForm({ ...form, series_code: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_issuer">Issuer</Label>
                <Input
                  id="edit_bond_issuer"
                  required
                  value={form.issuer}
                  onChange={(e) =>
                    setForm({ ...form, issuer: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_bond_description">
                Description (optional)
              </Label>
              <Input
                id="edit_bond_description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_type">Bond type</Label>
                <select
                  id="edit_bond_type"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.bond_type}
                  onChange={(e) =>
                    setForm({ ...form, bond_type: e.target.value as BondType })
                  }
                >
                  <option value="govt_primary">Government primary</option>
                  <option value="secondary_market">Secondary market</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_face_value">Face value</Label>
                <Input
                  id="edit_bond_face_value"
                  required
                  inputMode="decimal"
                  value={form.face_value}
                  onChange={(e) =>
                    setForm({ ...form, face_value: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_coupon_rate">
                  Coupon rate (% per year)
                </Label>
                <Input
                  id="edit_bond_coupon_rate"
                  required
                  inputMode="decimal"
                  value={form.coupon_rate}
                  onChange={(e) =>
                    setForm({ ...form, coupon_rate: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit_bond_coupon_frequency">
                  Coupon frequency
                </Label>
                <select
                  id="edit_bond_coupon_frequency"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.coupon_frequency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coupon_frequency: e.target.value as CouponFrequency,
                    })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annual">Semi-annual</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_bond_maturity">Maturity date</Label>
              <Input
                id="edit_bond_maturity"
                required
                type="date"
                value={form.maturity_date}
                onChange={(e) =>
                  setForm({ ...form, maturity_date: e.target.value })
                }
              />
            </div>
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
