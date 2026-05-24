import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableCell, TableRow } from '@/components/ui/table'
import { EditVehicleDialog } from '@/components/EditVehicleDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteVehicle } from '@/hooks/useVehicles'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { ownershipLabel } from '@/lib/ownership'
import type { VehicleListItem } from '@/api/types'

type Props = {
  item: VehicleListItem
  onSelect: (id: string) => void
}

export function VehicleListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteVehicle()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const ownerLabel = ownershipLabel(
    item.asset.ownership_type,
    item.asset.sole_owner_user_id,
    members,
    currentUser,
  )

  const vehicleForEdit = { asset: item.asset, details: item.details }

  function handleConfirmDelete() {
    deleteMutation.mutate(item.asset.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  const makeModel = [item.details.make, item.details.model]
    .filter(Boolean)
    .join(' ')
  const secondary = [
    item.details.vehicle_type,
    makeModel,
    item.details.year ? String(item.details.year) : null,
    item.details.plate_number,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => onSelect(item.asset.id)}
      >
        <TableCell>
          <div className="font-medium">{item.asset.display_name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {secondary || '—'}
          </div>
        </TableCell>
        <TableCell>{ownerLabel}</TableCell>
        <TableCell>
          {item.latest_snapshot ? (
            <>
              <div>
                {formatCurrency(
                  item.latest_snapshot.amount,
                  item.latest_snapshot.currency,
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatYearMonth(item.latest_snapshot.year_month)}
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Vehicle actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                variant="destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <EditVehicleDialog
        key={vehicleForEdit.asset.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        vehicle={vehicleForEdit}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this vehicle?"
        description={`${item.asset.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
