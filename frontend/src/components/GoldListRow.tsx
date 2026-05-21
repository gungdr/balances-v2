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
import { EditGoldDialog } from '@/components/EditGoldDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteGold } from '@/hooks/useInvestments'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { formatGoldPurity } from '@/lib/gold'
import type { GoldListItem } from '@/api/types'

type Props = {
  item: GoldListItem
  onSelect: (id: string) => void
}

export function GoldListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteGold()

  function handleConfirmDelete() {
    deleteMutation.mutate(item.investment.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => onSelect(item.investment.id)}
      >
        <TableCell>
          <div className="font-medium">{item.investment.display_name}</div>
          {item.investment.description && (
            <div className="text-xs text-muted-foreground">
              {item.investment.description}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="capitalize">{item.details.form}</div>
          <div className="text-xs text-muted-foreground">
            {formatGoldPurity(item.details.purity)}
          </div>
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
                aria-label="Gold actions"
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

      <EditGoldDialog
        key={item.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        gold={item}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this gold position?"
        description={`${item.investment.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
