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
import { useUpdateProperty } from '@/hooks/useProperties'
import { ApiError } from '@/api/client'
import type { Property } from '@/api/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Property
}

export function EditPropertyDialog({ open, onOpenChange, property }: Props) {
  const mutation = useUpdateProperty(property.asset.id)

  const [form, setForm] = useState({
    display_name: property.asset.display_name,
    description: property.asset.description ?? '',
    property_type: property.details.property_type,
    address: property.details.address ?? '',
    acquisition_date: property.details.acquisition_date
      ? property.details.acquisition_date.slice(0, 10)
      : '',
    acquisition_cost: property.details.acquisition_cost ?? '',
    annual_amortization_rate:
      property.details.annual_amortization_rate ?? '',
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate(
      {
        display_name: form.display_name,
        description: form.description || null,
        property_type: form.property_type,
        address: form.address || null,
        acquisition_date: form.acquisition_date || null,
        acquisition_cost: form.acquisition_cost || null,
        annual_amortization_rate: form.annual_amortization_rate || null,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>
            Update the property's details. Currency and ownership are not
            editable yet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="edit_p_display_name">Display name</Label>
            <Input
              id="edit_p_display_name"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_p_type">Type</Label>
            <select
              id="edit_p_type"
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
            <Label htmlFor="edit_p_address">Address (optional)</Label>
            <Input
              id="edit_p_address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit_p_acq_date">Acquisition date</Label>
              <Input
                id="edit_p_acq_date"
                type="date"
                value={form.acquisition_date}
                onChange={(e) =>
                  setForm({ ...form, acquisition_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_p_acq_cost">Acquisition cost</Label>
              <Input
                id="edit_p_acq_cost"
                inputMode="decimal"
                value={form.acquisition_cost}
                onChange={(e) =>
                  setForm({ ...form, acquisition_cost: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_p_amort">Annual amortization rate</Label>
            <Input
              id="edit_p_amort"
              inputMode="decimal"
              value={form.annual_amortization_rate}
              onChange={(e) =>
                setForm({
                  ...form,
                  annual_amortization_rate: e.target.value,
                })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit_p_description">Description (optional)</Label>
            <Input
              id="edit_p_description"
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
