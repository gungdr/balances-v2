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
import { EditPropertyDialog } from '@/components/EditPropertyDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteProperty } from '@/hooks/useProperties'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import type { PropertyListItem } from '@/api/types'

type Props = {
  item: PropertyListItem
  onSelect: (id: string) => void
}

export function PropertyListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteProperty()

  const propertyForEdit = { asset: item.asset, details: item.details }

  function handleConfirmDelete() {
    deleteMutation.mutate(item.asset.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  const secondary = [item.details.property_type, item.details.address]
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
        <TableCell className="capitalize">
          {item.asset.ownership_type}
        </TableCell>
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
                aria-label="Property actions"
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

      <EditPropertyDialog
        key={propertyForEdit.asset.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        property={propertyForEdit}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this property?"
        description={`${item.asset.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
