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
import { StatusBadge } from '@/components/StatusBadge'
import { EditLiabilityDialog } from '@/components/EditLiabilityDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteLiability } from '@/hooks/useLiabilities'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { isActiveStatus } from '@/lib/lifecycle'
import { cn } from '@/lib/utils'
import type { LiabilityListItem } from '@/api/types'

type Props = {
  item: LiabilityListItem
  // Resolved by the screen (nickname ?? display_name, or "Joint").
  ownerLabel: string
  onSelect: (id: string) => void
}

export function LiabilityListRow({ item, ownerLabel, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteLiability()

  const terminated = !isActiveStatus(item.liability.status)

  function handleConfirmDelete() {
    deleteMutation.mutate(item.liability.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <TableRow
        className={cn('cursor-pointer', terminated && 'text-muted-foreground')}
        onClick={() => onSelect(item.liability.id)}
      >
        <TableCell>
          <div className={cn('font-medium', terminated && 'font-normal')}>
            {item.liability.display_name}
          </div>
          <div className="text-xs text-muted-foreground">
            {item.liability.counterparty_name}
          </div>
        </TableCell>
        <TableCell>{ownerLabel}</TableCell>
        <TableCell>
          <StatusBadge group="liabilities" status={item.liability.status} />
        </TableCell>
        <TableCell className="text-right tabular-nums">
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
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
