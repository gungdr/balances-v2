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
import { useLiability, useDeleteLiability } from '@/hooks/useLiabilities'
import {
  useLiabilitySnapshots,
  useCreateLiabilitySnapshot,
  useUpdateLiabilitySnapshot,
  useDeleteLiabilitySnapshot,
} from '@/hooks/useLiabilitySnapshots'
import { CreateSnapshotDialog } from '@/components/CreateSnapshotDialog'
import { EditLiabilityDialog } from '@/components/EditLiabilityDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SnapshotRow } from '@/components/SnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { formatCurrency, formatDate } from '@/lib/format'

type Props = {
  liabilityId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function LiabilityDetail({ liabilityId, onBack }: Props) {
  const { data: liability, isPending, error } = useLiability(liabilityId)
  const { data: snapshots } = useLiabilitySnapshots(liabilityId)
  const deleteMutation = useDeleteLiability()
  const createSnapshotMutation = useCreateLiabilitySnapshot(liabilityId)
  const updateSnapshotMutation = useUpdateLiabilitySnapshot(liabilityId)
  const deleteSnapshotMutation = useDeleteLiabilitySnapshot(liabilityId)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(
    1,
    Math.ceil((snapshots?.length ?? 0) / PAGE_SIZE),
  )
  const effectivePage = Math.min(page, totalPages)

  function handleConfirmDelete() {
    deleteMutation.mutate(liabilityId, {
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
  if (!liability) return null

  const pageSnapshots = (snapshots ?? []).slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )

  const hasDetails =
    liability.principal ||
    liability.interest_rate ||
    liability.start_date ||
    liability.maturity_date ||
    liability.term_months !== null ||
    liability.description

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
            {liability.display_name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {liability.subtype} · {liability.counterparty_name}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateSnapshotDialog
            currency={liability.native_currency}
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
          <CardTitle>Liability Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            <span className="capitalize">{liability.ownership_type}</span> ·
            Currency: {liability.native_currency} · Status: {liability.status}
          </CardDescription>
        </CardHeader>
        {hasDetails && (
          <CardContent className="text-sm space-y-1">
            {liability.principal && (
              <p>
                <span className="text-muted-foreground">Principal:</span>{' '}
                {formatCurrency(liability.principal, liability.native_currency)}
              </p>
            )}
            {liability.interest_rate && (
              <p>
                <span className="text-muted-foreground">Interest rate:</span>{' '}
                {Number(liability.interest_rate).toFixed(2)}% /yr
              </p>
            )}
            {liability.term_months !== null && (
              <p>
                <span className="text-muted-foreground">Term:</span>{' '}
                {liability.term_months} months
              </p>
            )}
            {(liability.start_date || liability.maturity_date) && (
              <p>
                <span className="text-muted-foreground">Period:</span>{' '}
                {liability.start_date ? formatDate(liability.start_date) : '—'}
                {' → '}
                {liability.maturity_date
                  ? formatDate(liability.maturity_date)
                  : '—'}
              </p>
            )}
            {liability.description && <p className="pt-1">{liability.description}</p>}
          </CardContent>
        )}
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Balance Over Time</CardTitle>
            <CardDescription>
              Monthly balance progression in {liability.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={liability.native_currency}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly outstanding-balance readings (manual entry).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              outstanding balance.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSnapshots.map((s) => (
                    <SnapshotRow
                      key={s.id}
                      snapshot={s}
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

      <EditLiabilityDialog
        key={liability.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        liability={liability}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this liability?"
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
