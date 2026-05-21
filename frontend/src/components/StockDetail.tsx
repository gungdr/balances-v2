import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useStock, useDeleteStock } from '@/hooks/useInvestments'
import {
  useInvestmentSnapshots,
  useCreateInvestmentSnapshot,
  useUpdateInvestmentSnapshot,
  useDeleteInvestmentSnapshot,
} from '@/hooks/useInvestmentSnapshots'
import { CreateInvestmentSnapshotDialog } from '@/components/CreateInvestmentSnapshotDialog'
import { EditStockDialog } from '@/components/EditStockDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { InvestmentSnapshotRow } from '@/components/InvestmentSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'

type Props = {
  investmentId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function StockDetail({ investmentId, onBack }: Props) {
  const { data: stock, isPending, error } = useStock(investmentId)
  const { data: snapshots } = useInvestmentSnapshots(investmentId)
  const deleteMutation = useDeleteStock()
  const createSnapshotMutation = useCreateInvestmentSnapshot(
    investmentId,
    'stocks',
  )
  const updateSnapshotMutation = useUpdateInvestmentSnapshot(
    investmentId,
    'stocks',
  )
  const deleteSnapshotMutation = useDeleteInvestmentSnapshot(
    investmentId,
    'stocks',
  )

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(
    1,
    Math.ceil((snapshots?.length ?? 0) / PAGE_SIZE),
  )
  const effectivePage = Math.min(page, totalPages)

  function handleConfirmDelete() {
    deleteMutation.mutate(investmentId, {
      onSuccess: () => {
        setDeleteOpen(false)
        onBack()
      },
    })
  }

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </p>
    )
  }
  if (!stock) return null

  const pageSnapshots = (snapshots ?? []).slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 mb-1"
          >
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stock.investment.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {stock.details.ticker} · {stock.details.exchange}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateInvestmentSnapshotDialog
            currency={stock.investment.native_currency}
            mutation={createSnapshotMutation}
          />
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            <span className="capitalize">
              {stock.investment.ownership_type}
            </span>{' '}
            · Currency: {stock.investment.native_currency} · Status:{' '}
            {stock.investment.status}
          </CardDescription>
        </CardHeader>
        {stock.investment.description && (
          <CardContent className="text-sm">
            {stock.investment.description}
          </CardContent>
        )}
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Position Value Over Time</CardTitle>
            <CardDescription>
              Monthly value progression in {stock.investment.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={stock.investment.native_currency}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly quantity and price readings (manual entry).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              quantity and price.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total value</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSnapshots.map((s) => (
                    <InvestmentSnapshotRow
                      key={s.id}
                      snapshot={s}
                      quantityUnit="sh"
                      updateMutation={updateSnapshotMutation}
                      deleteMutation={deleteSnapshotMutation}
                    />
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="px-6 py-3 border-t">
                  <PaginationControls
                    page={effectivePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <EditStockDialog
        key={stock.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        stock={stock}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this stock position?"
        description="Snapshots and history will be hidden. This can be undone via the database, not yet via the UI."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault()
              if (page > 1) onPageChange(page - 1)
            }}
            aria-disabled={page === 1}
            className={page === 1 ? 'pointer-events-none opacity-50' : undefined}
          />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              href="#"
              isActive={p === page}
              onClick={(e) => {
                e.preventDefault()
                onPageChange(p)
              }}
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault()
              if (page < totalPages) onPageChange(page + 1)
            }}
            aria-disabled={page === totalPages}
            className={
              page === totalPages ? 'pointer-events-none opacity-50' : undefined
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
