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
import { EditTimeDepositDialog } from '@/components/EditTimeDepositDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteTimeDeposit } from '@/hooks/useInvestments'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import { maturityClass, maturityInfo } from '@/lib/maturity'
import type { TimeDepositListItem } from '@/api/types'

type Props = {
  item: TimeDepositListItem
  onSelect: (id: string) => void
}

export function TimeDepositListRow({ item, onSelect }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteTimeDeposit()

  function handleConfirmDelete() {
    deleteMutation.mutate(item.investment.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  const mInfo = maturityInfo(item.details.maturity_date)
  const ratePct = Number(item.details.interest_rate).toFixed(2)

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
          <div className="text-sm">{item.details.bank_name}</div>
          <div className="text-xs text-muted-foreground">
            {ratePct}% · {item.details.term_months}mo
          </div>
          <div className={`text-xs ${maturityClass(mInfo.state)}`}>
            {mInfo.label}
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
                aria-label="Time deposit actions"
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

      <EditTimeDepositDialog
        key={item.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        timeDeposit={item}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this time deposit?"
        description={`${item.investment.display_name} will be hidden from lists and reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
