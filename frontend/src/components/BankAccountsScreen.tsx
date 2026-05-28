import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader, type SortDir } from '@/components/SortableHeader'
import { useBankAccounts } from '@/hooks/useBankAccounts'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { CreateBankAccountDialog } from '@/components/CreateBankAccountDialog'
import { BankAccountListRow } from '@/components/BankAccountListRow'
import { ownershipLabel } from '@/lib/ownership'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { formatCurrency } from '@/lib/format'
import type { BankAccountListItem } from '@/api/types'

type Props = {
  onSelect: (id: string) => void
}

type SortKey = 'name' | 'ownership' | 'status' | 'balance'

// First click on a column sorts in this direction; clicking the active column
// again toggles. Balance leads with the largest (desc) since that reads most
// naturally for money.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  ownership: 'asc',
  status: 'asc',
  balance: 'desc',
}

// A list item enriched with the screen-resolved fields we sort on, so the
// comparator stays simple and the row doesn't re-resolve them.
type Row = {
  item: BankAccountListItem
  ownerLabel: string
  name: string
  status: string
  amount: number | null
}

export function BankAccountsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useBankAccounts()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'name',
    dir: 'asc',
  })
  // Terminated accounts are hidden by default to keep the list short; the
  // headline total is active-only regardless, so this toggle is purely a list
  // filter.
  const [showInactive, setShowInactive] = useState(false)

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: DEFAULT_DIR[key] },
    )
  }

  const rows = useMemo<Row[]>(
    () =>
      (data ?? []).map((item) => ({
        item,
        ownerLabel: ownershipLabel(
          item.asset.ownership_type,
          item.asset.sole_owner_user_id,
          members,
          currentUser,
        ),
        name: item.asset.display_name,
        status: item.asset.status,
        amount: item.latest_snapshot ? Number(item.latest_snapshot.amount) : null,
      })),
    [data, members, currentUser],
  )

  const sorted = useMemo(() => {
    const { key, dir } = sort
    const byName = (a: Row, b: Row) => a.name.localeCompare(b.name)
    return [...rows].sort((a, b) => {
      let primary = 0
      switch (key) {
        case 'name':
          primary = byName(a, b)
          break
        case 'ownership':
          primary = a.ownerLabel.localeCompare(b.ownerLabel)
          break
        case 'status':
          primary = statusLabel('assets', a.status).localeCompare(
            statusLabel('assets', b.status),
          )
          break
        case 'balance': {
          // Accounts with no snapshot always sort last, regardless of direction.
          if (a.amount === null || b.amount === null) {
            if (a.amount === null && b.amount === null) break
            return a.amount === null ? 1 : -1
          }
          primary = a.amount - b.amount
          break
        }
      }
      const directed = dir === 'asc' ? primary : -primary
      return directed !== 0 ? directed : byName(a, b)
    })
  }, [rows, sort])

  const { totals, count } = useMemo(
    () =>
      activeCurrencyTotals(
        rows.map((r) => ({ status: r.status, snapshot: r.item.latest_snapshot })),
      ),
    [rows],
  )

  const terminatedCount = rows.filter((r) => !isActiveStatus(r.status)).length
  const visibleRows = showInactive
    ? sorted
    : sorted.filter((r) => isActiveStatus(r.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Track monthly balances across your household's bank accounts.
          </p>
        </div>
        <CreateBankAccountDialog />
      </div>

      {totals.length > 0 && (
        <div className="rounded-lg border p-4" data-testid="bank-accounts-total">
          <div className="text-sm text-muted-foreground">Total balance</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums">
            {totals.map((t, i) => (
              <span key={t.currency}>
                {i > 0 && <span className="text-muted-foreground"> · </span>}
                {formatCurrency(String(t.amount), t.currency)}
              </span>
            ))}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            across {count} active account{count === 1 ? '' : 's'}
          </div>
        </div>
      )}

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No bank accounts yet</CardTitle>
            <CardDescription>
              Create your first bank account to start tracking month-end balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateBankAccountDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {terminatedCount > 0 && (
            <div className="flex justify-end">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  data-testid="show-inactive"
                />
                Show inactive accounts ({terminatedCount})
              </label>
            </div>
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active accounts. {terminatedCount} inactive account
              {terminatedCount === 1 ? '' : 's'} hidden — tick "Show inactive
              accounts" to {terminatedCount === 1 ? 'see it' : 'see them'}.
            </p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader
                        label="Name"
                        testId="sort-name"
                        active={sort.key === 'name'}
                        dir={sort.dir}
                        onSort={() => toggleSort('name')}
                      />
                      <SortableHeader
                        label="Ownership"
                        testId="sort-ownership"
                        active={sort.key === 'ownership'}
                        dir={sort.dir}
                        onSort={() => toggleSort('ownership')}
                      />
                      <SortableHeader
                        label="Status"
                        testId="sort-status"
                        active={sort.key === 'status'}
                        dir={sort.dir}
                        onSort={() => toggleSort('status')}
                      />
                      <SortableHeader
                        label="Latest balance"
                        testId="sort-balance"
                        align="right"
                        active={sort.key === 'balance'}
                        dir={sort.dir}
                        onSort={() => toggleSort('balance')}
                      />
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <BankAccountListRow
                        key={r.item.asset.id}
                        item={r.item}
                        ownerLabel={r.ownerLabel}
                        onSelect={onSelect}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
