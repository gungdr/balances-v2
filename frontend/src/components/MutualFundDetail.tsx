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
import { PaginationControls } from '@/components/PaginationControls'
import { useMutualFund, useDeleteMutualFund } from '@/hooks/useInvestments'
import {
  useInvestmentSnapshots,
  useCreateInvestmentSnapshot,
  useUpdateInvestmentSnapshot,
  useDeleteInvestmentSnapshot,
} from '@/hooks/useInvestmentSnapshots'
import { CreateQuantityPriceSnapshotDialog } from '@/components/CreateQuantityPriceSnapshotDialog'
import { EditMutualFundDialog } from '@/components/EditMutualFundDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { QuantityPriceSnapshotRow } from '@/components/QuantityPriceSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'

type Props = {
  investmentId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function MutualFundDetail({ investmentId, onBack }: Props) {
  const { data: mf, isPending, error } = useMutualFund(investmentId)
  const { data: snapshots } = useInvestmentSnapshots(investmentId)
  const deleteMutation = useDeleteMutualFund()
  const createSnapshotMutation = useCreateInvestmentSnapshot(
    investmentId,
    'mutual-funds',
  )
  const updateSnapshotMutation = useUpdateInvestmentSnapshot(
    investmentId,
    'mutual-funds',
  )
  const deleteSnapshotMutation = useDeleteInvestmentSnapshot(
    investmentId,
    'mutual-funds',
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
  if (!mf) return null

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
            {mf.investment.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mf.details.fund_code}
            {mf.details.fund_manager && ` · ${mf.details.fund_manager}`}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateQuantityPriceSnapshotDialog
            currency={mf.investment.native_currency}
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
          <CardTitle>Mutual Fund Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            <span className="capitalize">{mf.investment.ownership_type}</span>{' '}
            · Currency: {mf.investment.native_currency} · Status:{' '}
            {mf.investment.status}
          </CardDescription>
        </CardHeader>
        {mf.investment.description && (
          <CardContent className="text-sm">
            {mf.investment.description}
          </CardContent>
        )}
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Position Value Over Time</CardTitle>
            <CardDescription>
              Monthly value progression in {mf.investment.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={mf.investment.native_currency}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly units and NAV readings (manual entry).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              units and NAV.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>NAV</TableHead>
                    <TableHead>Total value</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSnapshots.map((s) => (
                    <QuantityPriceSnapshotRow
                      key={s.id}
                      snapshot={s}
                      quantityUnit="units"
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

      <EditMutualFundDialog
        key={mf.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        mutualFund={mf}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this mutual fund position?"
        description="Snapshots and history will be hidden. This can be undone via the database, not yet via the UI."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
