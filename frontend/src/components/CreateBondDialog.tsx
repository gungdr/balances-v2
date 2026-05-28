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
import { useCreateBond } from '@/hooks/useInvestments'
import { useSession } from '@/hooks/useSession'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { preferredName } from '@/lib/names'
import { ApiError } from '@/api/client'
import type { BondType, CouponFrequency } from '@/api/types'

function emptyForm() {
  return {
    display_name: '',
    description: '',
    ownership_type: 'joint' as 'sole' | 'joint',
    sole_owner_user_id: null as string | null,
    native_currency: 'IDR',
    bond_type: 'govt_primary' as BondType,
    series_code: '',
    issuer: '',
    face_value: '',
    coupon_rate: '',
    coupon_frequency: 'monthly' as CouponFrequency,
    maturity_date: '',
  }
}

export function CreateBondDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateBond()

  const effectiveSoleOwnerID = form.sole_owner_user_id ?? user?.id ?? null

  function close() {
    setOpen(false)
    setForm(emptyForm())
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
        bond_type: form.bond_type,
        series_code: form.series_code.trim() || null,
        issuer: form.issuer,
        face_value: form.face_value,
        coupon_rate: form.coupon_rate,
        coupon_frequency: form.coupon_frequency,
        maturity_date: form.maturity_date,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New bond</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New bond position</DialogTitle>
          <DialogDescription>
            Track a fixed-income instrument by face value, coupon, and
            maturity. Monthly snapshots record the dirty total value and the
            accrued-interest component.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="bond_display_name">Display name</Label>
              <Input
                id="bond_display_name"
                required
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                placeholder="ORI024 — Indonesian govt retail bond"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bond_series_code">Series code (optional)</Label>
                <Input
                  id="bond_series_code"
                  value={form.series_code}
                  onChange={(e) =>
                    setForm({ ...form, series_code: e.target.value })
                  }
                  placeholder="ORI024"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bond_issuer">Issuer</Label>
                <Input
                  id="bond_issuer"
                  required
                  value={form.issuer}
                  onChange={(e) =>
                    setForm({ ...form, issuer: e.target.value })
                  }
                  placeholder="Republik Indonesia"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bond_description">Description (optional)</Label>
              <Input
                id="bond_description"
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
                <Label htmlFor="bond_type">Bond type</Label>
                <select
                  id="bond_type"
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
                <Label htmlFor="bond_currency">Currency</Label>
                <Input
                  id="bond_currency"
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
              <Label htmlFor="bond_face_value">Face value</Label>
              <Input
                id="bond_face_value"
                required
                inputMode="decimal"
                value={form.face_value}
                onChange={(e) =>
                  setForm({ ...form, face_value: e.target.value })
                }
                placeholder="e.g. 50000000 for 50 lots of IDR 1,000,000 each"
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bond_coupon_rate">Coupon rate (% per year)</Label>
                <Input
                  id="bond_coupon_rate"
                  required
                  inputMode="decimal"
                  value={form.coupon_rate}
                  onChange={(e) =>
                    setForm({ ...form, coupon_rate: e.target.value })
                  }
                  placeholder="6.25"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bond_coupon_frequency">Coupon frequency</Label>
                <select
                  id="bond_coupon_frequency"
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
              <Label htmlFor="bond_maturity">Maturity date</Label>
              <Input
                id="bond_maturity"
                required
                type="date"
                value={form.maturity_date}
                onChange={(e) =>
                  setForm({ ...form, maturity_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-2">
              <Label>Ownership</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ownership_type"
                    value="joint"
                    checked={form.ownership_type === 'joint'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'joint' })
                    }
                  />
                  Joint
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ownership_type"
                    value="sole"
                    checked={form.ownership_type === 'sole'}
                    onChange={() =>
                      setForm({ ...form, ownership_type: 'sole' })
                    }
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
