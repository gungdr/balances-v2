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
import { useProperty, useDeleteProperty } from '@/hooks/useProperties'
import {
  useSnapshots,
  useCreateSnapshot,
  useUpdateSnapshot,
  useDeleteSnapshot,
} from '@/hooks/useAssetSnapshots'
import { CreateSnapshotDialog } from '@/components/CreateSnapshotDialog'
import { TerminatePositionDialog } from '@/components/TerminatePositionDialog'
import { StatusBadge } from '@/components/StatusBadge'
import { isActiveStatus } from '@/lib/lifecycle'
import { EditPropertyDialog } from '@/components/EditPropertyDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SnapshotRow } from '@/components/SnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatDate } from '@/lib/format'
import { ownershipLabel } from '@/lib/ownership'

type Props = {
  assetId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function PropertyDetail({ assetId, onBack }: Props) {
  const { data: property, isPending, error } = useProperty(assetId)
  const { data: snapshots } = useSnapshots(assetId)
  const deleteMutation = useDeleteProperty()
  const createSnapshotMutation = useCreateSnapshot(assetId)
  const updateSnapshotMutation = useUpdateSnapshot(assetId)
  const deleteSnapshotMutation = useDeleteSnapshot(assetId)
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(
    1,
    Math.ceil((snapshots?.length ?? 0) / PAGE_SIZE),
  )
  const effectivePage = Math.min(page, totalPages)

  function handleConfirmDelete() {
    deleteMutation.mutate(assetId, {
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
  if (!property) return null

  const { asset, details } = property
  const ownerLabel = ownershipLabel(
    asset.ownership_type,
    asset.sole_owner_user_id,
    members,
    currentUser,
  )
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
            {asset.display_name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {details.property_type}
            {details.address && ` · ${details.address}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isActiveStatus(asset.status) && (
            <CreateSnapshotDialog
              currency={asset.native_currency}
              mutation={createSnapshotMutation}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <TerminatePositionDialog
            group="assets"
            id={asset.id}
            listKey="properties"
            currentStatus={asset.status}
            currentTerminatedAt={asset.terminated_at}
            currentNote={asset.termination_note}
          />
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
          <CardTitle>Property Details</CardTitle>
          <CardDescription>
            Ownership: {ownerLabel} · Currency: {asset.native_currency} ·
            Status: <StatusBadge group="assets" status={asset.status} />
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {details.acquisition_date && (
            <p>
              <span className="text-muted-foreground">Acquired:</span>{' '}
              {formatDate(details.acquisition_date)}
              {details.acquisition_cost && (
                <>
                  {' '}for{' '}
                  {formatCurrency(details.acquisition_cost, asset.native_currency)}
                </>
              )}
            </p>
          )}
          {details.annual_amortization_rate && (
            <p>
              <span className="text-muted-foreground">
                Amortization rate:
              </span>{' '}
              {Number(details.annual_amortization_rate).toFixed(2)}% /yr
            </p>
          )}
          {asset.description && (
            <p className="pt-1">{asset.description}</p>
          )}
        </CardContent>
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Valuation Over Time</CardTitle>
            <CardDescription>
              Monthly valuation progression in {asset.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={asset.native_currency}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Snapshots</CardTitle>
          <CardDescription>
            Monthly valuation readings (manual entry).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              valuation.
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

      <EditPropertyDialog
        key={property.asset.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        property={property}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this property?"
        description="Snapshots and history will be hidden. This can be undone via the database, not yet via the UI."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
