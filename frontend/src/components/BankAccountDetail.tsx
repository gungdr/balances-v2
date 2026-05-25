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
import {
  useBankAccount,
  useDeleteBankAccount,
} from '@/hooks/useBankAccounts'
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
import { EditBankAccountDialog } from '@/components/EditBankAccountDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SnapshotRow } from '@/components/SnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { ownershipLabel } from '@/lib/ownership'

type Props = {
  assetId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function BankAccountDetail({ assetId, onBack }: Props) {
  const { data: account, isPending, error } = useBankAccount(assetId)
  const { data: snapshots } = useSnapshots(assetId)
  const deleteMutation = useDeleteBankAccount()
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
  // Derive during render so an out-of-range page (e.g., after a snapshot
  // delete shrinks totalPages) clamps to the last existing page without an
  // effect-driven setState. Per the M3.7 "stay on current page" rule.
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
  if (!account) return null

  const { asset, details } = account
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
          <p className="text-sm text-muted-foreground">
            {details.bank_name} · {details.account_number} ·{' '}
            {details.account_type}
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
            listKey="bank-accounts"
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
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Ownership: {ownerLabel} · Currency: {asset.native_currency} ·
            Status: <StatusBadge group="assets" status={asset.status} />
          </CardDescription>
        </CardHeader>
        {asset.description && (
          <CardContent>
            <p className="text-sm">{asset.description}</p>
          </CardContent>
        )}
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Balance Over Time</CardTitle>
            <CardDescription>
              Monthly balance progression in {asset.native_currency}.
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
            Monthly balance readings from your bank statements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!snapshots || snapshots.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No snapshots yet. Click "New snapshot" to record this month's
              balance.
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

      <EditBankAccountDialog
        key={account.asset.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        account={account}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this bank account?"
        description="Snapshots and history will be hidden. This can be undone via the database, not yet via the UI."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
