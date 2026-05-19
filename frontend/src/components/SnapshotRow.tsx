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
import { EditSnapshotDialog } from '@/components/EditSnapshotDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDeleteSnapshot } from '@/hooks/useBankAccounts'
import { formatCurrency, formatYearMonth, formatDate } from '@/lib/format'
import type { AssetSnapshot } from '@/api/types'

type Props = {
  snapshot: AssetSnapshot
  assetId: string
}

export function SnapshotRow({ snapshot, assetId }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useDeleteSnapshot(assetId)

  function handleConfirmDelete() {
    deleteMutation.mutate(snapshot.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="font-medium">
            {formatYearMonth(snapshot.year_month)}
          </div>
          {snapshot.as_of_date && (
            <div className="text-xs text-muted-foreground">
              statement: {formatDate(snapshot.as_of_date)}
            </div>
          )}
        </TableCell>
        <TableCell>{formatCurrency(snapshot.amount, snapshot.currency)}</TableCell>
        <TableCell className="text-muted-foreground">
          {snapshot.description ?? '—'}
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Snapshot actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      <EditSnapshotDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        assetId={assetId}
        snapshot={snapshot}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this snapshot?"
        description={`The ${formatYearMonth(snapshot.year_month)} reading will be hidden from reports. This can be undone via the database, not yet via the UI.`}
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
