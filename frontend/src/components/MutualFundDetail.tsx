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
import {
  useInvestmentTransactions,
  useCreateInvestmentTransaction,
  useUpdateInvestmentTransaction,
  useDeleteInvestmentTransaction,
} from '@/hooks/useInvestmentTransactions'
import { CreateQuantityPriceSnapshotDialog } from '@/components/CreateQuantityPriceSnapshotDialog'
import { CreateTradeTransactionDialog } from '@/components/CreateTradeTransactionDialog'
import { CreateCashIncomeTransactionDialog } from '@/components/CreateCashIncomeTransactionDialog'
import { CreateFeeTransactionDialog } from '@/components/CreateFeeTransactionDialog'
import { TransactionRow } from '@/components/TransactionRow'
import { TerminatePositionDialog } from '@/components/TerminatePositionDialog'
import { StatusBadge } from '@/components/StatusBadge'
import { isActiveStatus } from '@/lib/lifecycle'
import { EditMutualFundDialog } from '@/components/EditMutualFundDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { QuantityPriceSnapshotRow } from '@/components/QuantityPriceSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { ownershipLabel } from '@/lib/ownership'
import { reconcileQuantity } from '@/lib/reconciliation'

type Props = {
  investmentId: string
  onBack: () => void
}

const PAGE_SIZE = 12

export function MutualFundDetail({ investmentId, onBack }: Props) {
  const { data: mf, isPending, error } = useMutualFund(investmentId)
  const { data: snapshots } = useInvestmentSnapshots(investmentId)
  const { data: transactions } = useInvestmentTransactions(investmentId)
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
  const createTransactionMutation = useCreateInvestmentTransaction(investmentId)
  const updateTransactionMutation = useUpdateInvestmentTransaction(investmentId)
  const deleteTransactionMutation = useDeleteInvestmentTransaction(investmentId)
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [txnPage, setTxnPage] = useState(1)

  const totalPages = Math.max(
    1,
    Math.ceil((snapshots?.length ?? 0) / PAGE_SIZE),
  )
  const effectivePage = Math.min(page, totalPages)
  const totalTxnPages = Math.max(
    1,
    Math.ceil((transactions?.length ?? 0) / PAGE_SIZE),
  )
  const effectiveTxnPage = Math.min(txnPage, totalTxnPages)
  const latestSnapshot = snapshots && snapshots.length > 0 ? snapshots[0] : null
  const recon = reconcileQuantity(latestSnapshot, transactions)

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
  const pageTransactions = (transactions ?? []).slice(
    (effectiveTxnPage - 1) * PAGE_SIZE,
    effectiveTxnPage * PAGE_SIZE,
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
          {isActiveStatus(mf.investment.status) && (
            <CreateQuantityPriceSnapshotDialog
              currency={mf.investment.native_currency}
              mutation={createSnapshotMutation}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <TerminatePositionDialog
            group="investments"
            id={mf.investment.id}
            listKey="mutual-funds"
            currentStatus={mf.investment.status}
            currentTerminatedAt={mf.investment.terminated_at}
            currentNote={mf.investment.termination_note}
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
          <CardTitle>Mutual Fund Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            {ownershipLabel(
              mf.investment.ownership_type,
              mf.investment.sole_owner_user_id,
              members,
              currentUser,
            )}{' '}
            · Currency: {mf.investment.native_currency} · Status:{' '}
            <StatusBadge group="investments" status={mf.investment.status} />
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Trades, distributions, and fees. Cash impacts do not
                auto-update bank balances.
              </CardDescription>
            </div>
            {isActiveStatus(mf.investment.status) && (
              <div className="flex flex-wrap gap-2">
                <CreateTradeTransactionDialog
                  currency={mf.investment.native_currency}
                  txnType="buy"
                  quantityUnit="units"
                  mutation={createTransactionMutation}
                />
                <CreateTradeTransactionDialog
                  currency={mf.investment.native_currency}
                  txnType="sell"
                  quantityUnit="units"
                  mutation={createTransactionMutation}
                />
                <CreateCashIncomeTransactionDialog
                  currency={mf.investment.native_currency}
                  txnType="distribution"
                  mutation={createTransactionMutation}
                />
                <CreateFeeTransactionDialog
                  currency={mf.investment.native_currency}
                  quantityUnit="units"
                  mutation={createTransactionMutation}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recon && !recon.matches && (
            <div className="mx-6 mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Latest snapshot units ({recon.actual}) don't match ledger total
              ({recon.expected}). Snapshots remain the source of truth —
              review trades or fees if this is unexpected.
            </div>
          )}
          {!transactions || transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No transactions yet. Record a Buy or Distribution to start the
              ledger.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Cash impact</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTransactions.map((t) => (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      quantityUnit="units"
                      updateMutation={updateTransactionMutation}
                      deleteMutation={deleteTransactionMutation}
                    />
                  ))}
                </TableBody>
              </Table>
              {totalTxnPages > 1 && (
                <div className="px-6 py-3 border-t">
                  <PaginationControls
                    page={effectiveTxnPage}
                    totalPages={totalTxnPages}
                    onPageChange={setTxnPage}
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
