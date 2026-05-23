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
import { useBond, useDeleteBond } from '@/hooks/useInvestments'
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
import { CreateAccruedInterestSnapshotDialog } from '@/components/CreateAccruedInterestSnapshotDialog'
import { CreateTradeTransactionDialog } from '@/components/CreateTradeTransactionDialog'
import { CreateCashIncomeTransactionDialog } from '@/components/CreateCashIncomeTransactionDialog'
import { CreateFeeTransactionDialog } from '@/components/CreateFeeTransactionDialog'
import { CreateMaturityTransactionDialog } from '@/components/CreateMaturityTransactionDialog'
import { TransactionRow } from '@/components/TransactionRow'
import { EditBondDialog } from '@/components/EditBondDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AccruedInterestSnapshotRow } from '@/components/AccruedInterestSnapshotRow'
import { SnapshotChart } from '@/components/SnapshotChart'
import { formatCurrency, formatDate } from '@/lib/format'
import { maturityClass, maturityInfo } from '@/lib/maturity'
import type { CouponFrequency } from '@/api/types'

type Props = {
  investmentId: string
  onBack: () => void
}

const PAGE_SIZE = 12

function frequencyLabel(f: CouponFrequency): string {
  switch (f) {
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'semi_annual':
      return 'Semi-annual'
    case 'annual':
      return 'Annual'
  }
}

export function BondDetail({ investmentId, onBack }: Props) {
  const { data: bond, isPending, error } = useBond(investmentId)
  const { data: snapshots } = useInvestmentSnapshots(investmentId)
  const { data: transactions } = useInvestmentTransactions(investmentId)
  const deleteMutation = useDeleteBond()
  const createSnapshotMutation = useCreateInvestmentSnapshot(
    investmentId,
    'bonds',
  )
  const updateSnapshotMutation = useUpdateInvestmentSnapshot(
    investmentId,
    'bonds',
  )
  const deleteSnapshotMutation = useDeleteInvestmentSnapshot(
    investmentId,
    'bonds',
  )
  const createTransactionMutation = useCreateInvestmentTransaction(investmentId)
  const updateTransactionMutation = useUpdateInvestmentTransaction(investmentId)
  const deleteTransactionMutation = useDeleteInvestmentTransaction(investmentId)

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
  if (!bond) return null

  const pageSnapshots = (snapshots ?? []).slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )
  const pageTransactions = (transactions ?? []).slice(
    (effectiveTxnPage - 1) * PAGE_SIZE,
    effectiveTxnPage * PAGE_SIZE,
  )
  // Maturity is uniquely terminal — once recorded, the position is matured
  // and no further transactions should land. The hard guard (status flip +
  // "no transactions after matured" rule) lands with M4.8 lifecycle UI.
  // This UI hide is a band-aid until then.
  const hasMaturity = transactions?.some(
    (t) => t.transaction_type === 'maturity',
  )
  const mInfo = maturityInfo(bond.details.maturity_date)
  const couponPct = Number(bond.details.coupon_rate).toFixed(2)
  const subtitleBits = [
    bond.details.series_code,
    bond.details.bond_type === 'govt_primary'
      ? 'Government primary'
      : 'Secondary market',
    bond.details.issuer,
  ].filter(Boolean)

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
            {bond.investment.display_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {subtitleBits.join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateAccruedInterestSnapshotDialog
            currency={bond.investment.native_currency}
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
          <CardTitle>Bond Details</CardTitle>
          <CardDescription>
            Ownership:{' '}
            <span className="capitalize">
              {bond.investment.ownership_type}
            </span>{' '}
            · Currency: {bond.investment.native_currency} · Status:{' '}
            {bond.investment.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Face value:</span>{' '}
            {formatCurrency(
              bond.details.face_value,
              bond.investment.native_currency,
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Coupon:</span> {couponPct}%
            /yr · {frequencyLabel(bond.details.coupon_frequency)}
          </p>
          <p>
            <span className="text-muted-foreground">Maturity:</span>{' '}
            {formatDate(bond.details.maturity_date)}{' '}
            <span className={maturityClass(mInfo.state)}>
              ({mInfo.label})
            </span>
          </p>
          {bond.investment.description && (
            <p className="pt-1">{bond.investment.description}</p>
          )}
        </CardContent>
      </Card>

      {snapshots && snapshots.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Position Value Over Time</CardTitle>
            <CardDescription>
              Monthly total value progression in{' '}
              {bond.investment.native_currency}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SnapshotChart
              snapshots={snapshots}
              currency={bond.investment.native_currency}
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
              reading. For held-to-maturity bonds (Indonesian govt-primary
              where coupons pay out to your bank account), a single initial
              snapshot at face value is enough — snapshot carry-forward
              handles every subsequent month until maturity.
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
                Buys / sells (secondary market), coupons, fees, and the
                terminal maturity event. For Indonesian govt-primary retail
                bonds, log each coupon as received.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <CreateTradeTransactionDialog
                currency={bond.investment.native_currency}
                txnType="buy"
                quantityUnit="lot"
                mutation={createTransactionMutation}
              />
              <CreateTradeTransactionDialog
                currency={bond.investment.native_currency}
                txnType="sell"
                quantityUnit="lot"
                mutation={createTransactionMutation}
              />
              <CreateCashIncomeTransactionDialog
                currency={bond.investment.native_currency}
                txnType="coupon"
                mutation={createTransactionMutation}
              />
              <CreateFeeTransactionDialog
                currency={bond.investment.native_currency}
                quantityUnit="lot"
                mutation={createTransactionMutation}
              />
              {!hasMaturity && (
                <CreateMaturityTransactionDialog
                  currency={bond.investment.native_currency}
                  mutation={createTransactionMutation}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!transactions || transactions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No transactions yet. Record a Buy or Coupon to start the
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
                      quantityUnit="lot"
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

      <EditBondDialog
        key={bond.investment.id}
        open={editOpen}
        onOpenChange={setEditOpen}
        bond={bond}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this bond position?"
        description="Snapshots and history will be hidden. This can be undone via the database, not yet via the UI."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
