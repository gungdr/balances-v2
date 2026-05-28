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
import { useCreateProperty } from '@/hooks/useProperties'
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
  property_type: 'house' as 'house' | 'apartment' | 'land' | 'commercial',
  address: '',
  acquisition_date: '',
  acquisition_cost: '',
  annual_amortization_rate: '',
}

export function CreatePropertyDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const { data: user } = useSession()
  const { data: members } = useHouseholdMembers()
  const mutation = useCreateProperty()

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
        property_type: form.property_type,
        address: form.address || null,
        acquisition_date: form.acquisition_date || null,
        acquisition_cost: form.acquisition_cost || null,
        annual_amortization_rate: form.annual_amortization_rate || null,
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>+ New property</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New property</DialogTitle>
          <DialogDescription>
            Track a property in your household. You'll record monthly value
            snapshots manually; an amortization rate helper UI will arrive
            later.
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
              placeholder="House in Bandung"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="property_type">Type</Label>
              <select
                id="property_type"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.property_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    property_type: e.target.value as typeof form.property_type,
                  })
                }
              >
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="land">Land</option>
                <option value="commercial">Commercial</option>
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
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="acquisition_date">Acquisition date (optional)</Label>
              <Input
                id="acquisition_date"
                type="date"
                value={form.acquisition_date}
                onChange={(e) =>
                  setForm({ ...form, acquisition_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acquisition_cost">Acquisition cost (optional)</Label>
              <Input
                id="acquisition_cost"
                inputMode="decimal"
                value={form.acquisition_cost}
                onChange={(e) =>
                  setForm({ ...form, acquisition_cost: e.target.value })
                }
                placeholder="1500000000"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="annual_amortization_rate">
              Annual amortization rate (%, optional)
            </Label>
            <Input
              id="annual_amortization_rate"
              inputMode="decimal"
              value={form.annual_amortization_rate}
              onChange={(e) =>
                setForm({
                  ...form,
                  annual_amortization_rate: e.target.value,
                })
              }
              placeholder="0.02 = 2% per year"
            />
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
