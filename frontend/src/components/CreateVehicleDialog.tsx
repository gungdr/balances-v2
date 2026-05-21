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
import { useCreateVehicle } from '@/hooks/useVehicles'
import { useSession } from '@/hooks/useSession'
import { ApiError } from '@/api/client'

const empty = {
  display_name: '',
  description: '',
  ownership_type: 'joint' as 'sole' | 'joint',
  native_currency: 'IDR',
  vehicle_type: 'car' as 'car' | 'motorcycle' | 'other',
  make: '',
  model: '',
  year: '',
  plate_number: '',
  annual_depreciation_rate: '',
}

export function CreateVehicleDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const { data: user } = useSession()
  const mutation = useCreateVehicle()

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
        sole_owner_user_id: form.ownership_type === 'sole' ? user.id : null,
        native_currency: form.native_currency,
        vehicle_type: form.vehicle_type,
        make: form.make || null,
        model: form.model || null,
        year: form.year ? Number(form.year) : null,
        plate_number: form.plate_number || null,
        annual_depreciation_rate: form.annual_depreciation_rate || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New vehicle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New vehicle</DialogTitle>
          <DialogDescription>
            Track a vehicle in your household. You'll record monthly value
            snapshots manually; a depreciation rate helper UI will arrive later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="v_display_name">Display name</Label>
            <Input
              id="v_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
              placeholder="Honda HR-V"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="v_type">Type</Label>
              <select
                id="v_type"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.vehicle_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vehicle_type: e.target.value as typeof form.vehicle_type,
                  })
                }
              >
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v_native_currency">Currency</Label>
              <Input
                id="v_native_currency"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="v_make">Make (optional)</Label>
              <Input
                id="v_make"
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="Honda"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v_model">Model (optional)</Label>
              <Input
                id="v_model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="HR-V"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="v_year">Year (optional)</Label>
              <Input
                id="v_year"
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2022"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="v_plate">Plate number (optional)</Label>
              <Input
                id="v_plate"
                value={form.plate_number}
                onChange={(e) =>
                  setForm({ ...form, plate_number: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="v_depr">
              Annual depreciation rate (%, optional)
            </Label>
            <Input
              id="v_depr"
              inputMode="decimal"
              value={form.annual_depreciation_rate}
              onChange={(e) =>
                setForm({
                  ...form,
                  annual_depreciation_rate: e.target.value,
                })
              }
              placeholder="0.15 = 15% per year"
            />
          </div>

          <div className="grid gap-2">
            <Label>Ownership</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="v_ownership_type"
                  value="joint"
                  checked={form.ownership_type === 'joint'}
                  onChange={() => setForm({ ...form, ownership_type: 'joint' })}
                />
                Joint
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="v_ownership_type"
                  value="sole"
                  checked={form.ownership_type === 'sole'}
                  onChange={() => setForm({ ...form, ownership_type: 'sole' })}
                />
                Mine
              </label>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="v_description">Description (optional)</Label>
            <Input
              id="v_description"
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
