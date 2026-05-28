import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/SortableHeader'
import { ListHeadline } from '@/components/ListHeadline'
import { ShowInactiveToggle } from '@/components/ShowInactiveToggle'
import { useReceivables } from '@/hooks/useReceivables'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { useTableSort, type ColumnSort } from '@/hooks/useTableSort'
import { CreateReceivableDialog } from '@/components/CreateReceivableDialog'
import { ReceivableListRow } from '@/components/ReceivableListRow'
import { ownershipLabel } from '@/lib/ownership'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { byNumberNullsLast, byText } from '@/lib/sort'
import type { ReceivableListItem } from '@/api/types'

type Props = {
  onSelect: (id: string) => void
}

type SortKey = 'name' | 'ownership' | 'status' | 'balance'

type Row = {
  item: ReceivableListItem
  ownerLabel: string
  name: string
  status: string
  statusText: string
  amount: number | null
}

const tiebreakByName = (a: Row, b: Row) => a.name.localeCompare(b.name)

export function ReceivablesScreen({ onSelect }: Props) {
  const { data, isPending, error } = useReceivables()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const [showInactive, setShowInactive] = useState(false)

  const rows = useMemo<Row[]>(
    () =>
      (data ?? []).map((item) => ({
        item,
        ownerLabel: ownershipLabel(
          item.receivable.ownership_type,
          item.receivable.sole_owner_user_id,
          members,
          currentUser,
        ),
        name: item.receivable.display_name,
        status: item.receivable.status,
        statusText: statusLabel('receivables', item.receivable.status),
        amount: item.latest_snapshot ? Number(item.latest_snapshot.amount) : null,
      })),
    [data, members, currentUser],
  )

  const columns = useMemo<Record<SortKey, ColumnSort<Row>>>(
    () => ({
      name: { dir: 'asc', cmp: byText((r) => r.name) },
      ownership: { dir: 'asc', cmp: byText((r) => r.ownerLabel) },
      status: { dir: 'asc', cmp: byText((r) => r.statusText) },
      balance: { dir: 'desc', cmp: byNumberNullsLast((r) => r.amount) },
    }),
    [],
  )

  const { sorted, sortKey, sortDir, toggle } = useTableSort(rows, columns, {
    defaultKey: 'name',
    tiebreak: tiebreakByName,
  })

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
          <h1 className="text-2xl font-semibold tracking-tight">Receivables</h1>
          <p className="text-sm text-muted-foreground">
            Money owed to your household — loans, deposits in transit,
            outstanding refunds.
          </p>
        </div>
        <CreateReceivableDialog />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label="Total outstanding"
        noun="receivable"
        nounPlural="receivables"
        testId="receivables-total"
      />

      {isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No receivables yet</CardTitle>
            <CardDescription>
              Create your first receivable to start tracking month-end balances
              owed to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateReceivableDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {terminatedCount > 0 && (
            <ShowInactiveToggle
              count={terminatedCount}
              nounPlural="receivables"
              checked={showInactive}
              onChange={setShowInactive}
            />
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active receivables. {terminatedCount} inactive receivable
              {terminatedCount === 1 ? '' : 's'} hidden — tick "Show inactive
              receivables" to {terminatedCount === 1 ? 'see it' : 'see them'}.
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
                        active={sortKey === 'name'}
                        dir={sortDir}
                        onSort={() => toggle('name')}
                      />
                      <SortableHeader
                        label="Ownership"
                        testId="sort-ownership"
                        active={sortKey === 'ownership'}
                        dir={sortDir}
                        onSort={() => toggle('ownership')}
                      />
                      <SortableHeader
                        label="Status"
                        testId="sort-status"
                        active={sortKey === 'status'}
                        dir={sortDir}
                        onSort={() => toggle('status')}
                      />
                      <SortableHeader
                        label="Latest balance"
                        testId="sort-balance"
                        align="right"
                        active={sortKey === 'balance'}
                        dir={sortDir}
                        onSort={() => toggle('balance')}
                      />
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <ReceivableListRow
                        key={r.item.receivable.id}
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
