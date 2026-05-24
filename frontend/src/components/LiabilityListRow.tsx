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
import { EditLiabilityDialog } from '@/components/EditLiabilityDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteLiability } from '@/hooks/useLiabilities'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { ownershipLabel } from '@/lib/ownership'
import type { LiabilityListItem } from '@/api/types'

type Props = {
  item: LiabilityListItem
  onSelect: (id: string) => void
}

export function LiabilityListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteLiability()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const ownerLabel = ownershipLabel(
    item.liability.ownership_type,
    item.liability.sole_owner_user_id,
    members,
    currentUser,
  )

  function handleConfirmDelete() {
    deleteMutation.mutate(item.liability.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => onSelect(item.liability.id)}
      >
        <TableCell>
          <div className="font-medium">{item.liability.display_name}</div>
          <div className="text-xs text-muted-foreground">
            {item.liability.counterparty_name}
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
                aria-label="Liability actions"
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

      <EditLiabilityDialog
        key={item.liability.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        liability={item.liability}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this liability?"
        description={`${item.liability.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
