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
import {
  useTimeDeposit,
  useDeleteTimeDeposit,
} from '@/hooks/useInvestments'
import {
  useInvestmentSnapshots,
  useCreateInvestmentSnapshot,
  useUpdateInvestmentSnapshot,
  useDeleteInvestmentSnapshot,
} from '@/hooks/useInvestmentSnapshots'
import { CreateAccruedInterestSnapshotDialog } from '@/components/CreateAccruedInterestSnapshotDialog'
import { EditTimeDepositDialog } from '@/components/EditTimeDepositDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AccruedInterestSnapshotRow } from '@/components/AccruedInterestSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { formatCurrency, formatDate } from '@/lib/format'
import { maturityClass, maturityInfo } from '@/lib/maturity'
import type { RolloverPolicy } from '@/api/types'

type Props = {
  investmentId: string
  onBack: () => void
}

const PAGE_SIZE = 12

function rolloverLabel(p: RolloverPolicy): string {
  switch (p) {
    case 'auto_renew_principal':
      return 'Auto-renew principal'
    case 'auto_renew_with_interest':
      return 'Auto-renew with interest'
    case 'no_rollover':
      return 'No rollover'
  }
}

export function TimeDepositDetail({ investmentId, onBack }: Props) {
  const { data: td, isPending, error } = useTimeDeposit(investmentId)
  const { data: snapshots } = useInvestmentSnapshots(investmentId)
  const deleteMutation = useDeleteTimeDeposit()
  const createSnapshotMutation = useCreateInvestmentSnapshot(
    investmentId,
    'time-deposits',
  )
  const updateSnapshotMutation = useUpdateInvestmentSnapshot(
    investmentId,
    'time-deposits',
  )
  const deleteSnapshotMutation = useDeleteInvestmentSnapshot(
    investmentId,
    'time-deposits',
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
  if (!td) return null

  const pageSnapshots = (snapshots ?? []).slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )
  const mInfo = maturityInfo(td.details.maturity_date)
  const ratePct = Number(td.details.interest_rate).toFixed(2)

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
            {td.investment.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {td.details.bank_name} · {ratePct}% · {td.details.term_months}mo
          </p>
        </div>
        <div className="flex gap-2">
          <CreateAccruedInterestSnapshotDialog
            currency={td.investment.native_currency}
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
          <CardTitle>Time Deposit Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            <span className="capitalize">{td.investment.ownership_type}</span>{' '}
            · Currency: {td.investment.native_currency} · Status:{' '}
            {td.investment.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Principal:</span>{' '}
            {formatCurrency(
              td.details.principal,
              td.investment.native_currency,
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Placement:</span>{' '}
            {formatDate(td.details.placement_date)}
          </p>
          <p>
            <span className="text-muted-foreground">Maturity:</span>{' '}
            {formatDate(td.details.maturity_date)}{' '}
            <span className={maturityClass(mInfo.state)}>
              ({mInfo.label})
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">At maturity:</span>{' '}
            {rolloverLabel(td.details.rollover_policy)}
          </p>
          {td.investment.description && (
            <p className="pt-1">{td.investment.description}</p>
          )}
        </CardContent>
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Position Value Over Time</CardTitle>
            <CardDescription>
              Monthly total value progression in{' '}
              {td.investment.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={td.investment.native_currency}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly total value and accrued-interest breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              total value and accrued interest.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Accrued</TableHead>
                    <TableHead>Total value</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSnapshots.map((s) => (
                    <AccruedInterestSnapshotRow
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

      <EditTimeDepositDialog
        key={td.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        timeDeposit={td}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this time deposit?"
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
