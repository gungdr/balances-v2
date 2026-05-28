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
  useTimeDeposit,
  useDeleteTimeDeposit,
} from '@/hooks/useInvestments'
import {
  useInvestmentSnapshots,
  useCreateInvestmentSnapshot,
  useUpdateInvestmentSnapshot,
  useDeleteInvestmentSnapshot,
  useImportInvestmentSnapshots,
  investmentImportTemplateUrl,
} from '@/hooks/useInvestmentSnapshots'
import {
  useInvestmentTransactions,
  useCreateInvestmentTransaction,
  useUpdateInvestmentTransaction,
  useDeleteInvestmentTransaction,
} from '@/hooks/useInvestmentTransactions'
import { CreateAccruedInterestSnapshotDialog } from '@/components/CreateAccruedInterestSnapshotDialog'
import { ImportSnapshotsDialog } from '@/components/ImportSnapshotsDialog'
import { CreateMaturityTransactionDialog } from '@/components/CreateMaturityTransactionDialog'
import { TransactionRow } from '@/components/TransactionRow'
import { TerminatePositionDialog } from '@/components/TerminatePositionDialog'
import { StatusBadge } from '@/components/StatusBadge'
import { isActiveStatus } from '@/lib/lifecycle'
import { EditTimeDepositDialog } from '@/components/EditTimeDepositDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AccruedInterestSnapshotRow } from '@/components/AccruedInterestSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatDate } from '@/lib/format'
import { maturityClass, maturityInfo } from '@/lib/maturity'
import { ownershipLabel } from '@/lib/ownership'
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
  const { data: transactions } = useInvestmentTransactions(investmentId)
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
  const importSnapshotMutation = useImportInvestmentSnapshots(
    investmentId,
    'time-deposits',
  )
  const createTransactionMutation = useCreateInvestmentTransaction(
    investmentId,
    'time-deposits',
  )
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
  const pageTransactions = (transactions ?? []).slice(
    (effectiveTxnPage - 1) * PAGE_SIZE,
    effectiveTxnPage * PAGE_SIZE,
  )
  // Maturity is uniquely terminal: posting it flips the position to 'matured'
  // (backend hard guard, ADR-0009), after which the transaction-create row is
  // gated off entirely by isActiveStatus below.
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
          {isActiveStatus(td.investment.status) && (
            <>
              <CreateAccruedInterestSnapshotDialog
                currency={td.investment.native_currency}
                mutation={createSnapshotMutation}
              />
              <ImportSnapshotsDialog
                templateUrl={investmentImportTemplateUrl(td.investment.id)}
                mutation={importSnapshotMutation}
                currency={td.investment.native_currency}
              />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <TerminatePositionDialog
            group="investments"
            id={td.investment.id}
            listKey="time-deposits"
            currentStatus={td.investment.status}
            currentTerminatedAt={td.investment.terminated_at}
            currentNote={td.investment.termination_note}
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
          <CardTitle>Time Deposit Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            {ownershipLabel(
              td.investment.ownership_type,
              td.investment.sole_owner_user_id,
              members,
              currentUser,
            )}{' '}
            · Currency: {td.investment.native_currency} · Status:{' '}
            <StatusBadge group="investments" status={td.investment.status} />
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Record the Maturity event when the term ends. The configured
                rollover policy seeds the disposition defaults; banks can
                deviate.
              </CardDescription>
            </div>
            {isActiveStatus(td.investment.status) && (
              <div className="flex flex-wrap gap-2">
                <CreateMaturityTransactionDialog
                  currency={td.investment.native_currency}
                  rolloverPolicy={td.details.rollover_policy}
                  mutation={createTransactionMutation}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!transactions || transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No transactions yet. Record a Maturity when the term ends.
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
                      quantityUnit=""
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
