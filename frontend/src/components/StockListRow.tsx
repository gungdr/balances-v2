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
import { EditStockDialog } from '@/components/EditStockDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteStock } from '@/hooks/useInvestments'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import type { StockListItem } from '@/api/types'

type Props = {
  item: StockListItem
  onSelect: (id: string) => void
}

export function StockListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteStock()

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
          <div className="font-mono text-sm">{item.details.ticker}</div>
          <div className="text-xs text-muted-foreground">
            {item.details.exchange}
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
                aria-label="Stock actions"
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

      <EditStockDialog
        key={item.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        stock={item}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this stock position?"
        description={`${item.investment.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
