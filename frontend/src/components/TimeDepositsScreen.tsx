import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/SortableHeader'
import { ListHeadline } from '@/components/ListHeadline'
import { ShowInactiveToggle } from '@/components/ShowInactiveToggle'
import {
  RiskProfileFilter,
  type RiskProfileFilterValue,
} from '@/components/RiskProfileFilter'
import { useTimeDeposits } from '@/hooks/useInvestments'
import { useTableSort, type ColumnSort } from '@/hooks/useTableSort'
import { CreateTimeDepositDialog } from '@/components/CreateTimeDepositDialog'
import { TimeDepositListRow } from '@/components/TimeDepositListRow'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { byNumberNullsLast, byText } from '@/lib/sort'
import type { TimeDepositListItem } from '@/api/types'

type Props = {
  onSelect: (id: string) => void
}

type SortKey = 'name' | 'status' | 'value'

type Row = {
  item: TimeDepositListItem
  name: string
  status: string
  statusText: string
  amount: number | null
}

const tiebreakByName = (a: Row, b: Row) => a.name.localeCompare(b.name)

export function TimeDepositsScreen({ onSelect }: Props) {
  const { data, isPending, error } = useTimeDeposits()
  const [showInactive, setShowInactive] = useState(false)
  const [riskFilter, setRiskFilter] = useState<RiskProfileFilterValue>('all')

  const rows = useMemo<Row[]>(
    () =>
      (data ?? []).map((item) => ({
        item,
        name: item.investment.display_name,
        status: item.investment.status,
        statusText: statusLabel('investments', item.investment.status),
        amount: item.latest_snapshot ? Number(item.latest_snapshot.amount) : null,
      })),
    [data],
  )

  const columns = useMemo<Record<SortKey, ColumnSort<Row>>>(
    () => ({
      name: { dir: 'asc', cmp: byText((r) => r.name) },
      status: { dir: 'asc', cmp: byText((r) => r.statusText) },
      value: { dir: 'desc', cmp: byNumberNullsLast((r) => r.amount) },
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
  const visibleRows = (showInactive
    ? sorted
    : sorted.filter((r) => isActiveStatus(r.status))
  ).filter((r) =>
    riskFilter === 'all' ? true : r.item.investment.risk_profile === riskFilter,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Deposits</h1>
          <p className="text-sm text-muted-foreground">
            Locked-principal bank placements — tracked by bank, rate, and term,
            with monthly accrued-interest snapshots.
          </p>
        </div>
        <CreateTimeDepositDialog />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label="Total value"
        noun="position"
        nounPlural="positions"
        testId="time-deposits-total"
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
            <CardTitle>No time deposits yet</CardTitle>
            <CardDescription>
              Create your first time deposit to start tracking month-end value
              and accrued interest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTimeDepositDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          <RiskProfileFilter value={riskFilter} onChange={setRiskFilter} />
          {terminatedCount > 0 && (
            <ShowInactiveToggle
              count={terminatedCount}
              nounPlural="positions"
              checked={showInactive}
              onChange={setShowInactive}
            />
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active positions. {terminatedCount} inactive position
              {terminatedCount === 1 ? '' : 's'} hidden — tick "Show inactive
              positions" to {terminatedCount === 1 ? 'see it' : 'see them'}.
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
                      <TableHead>Identity</TableHead>
                      <SortableHeader
                        label="Status"
                        testId="sort-status"
                        active={sortKey === 'status'}
                        dir={sortDir}
                        onSort={() => toggle('status')}
                      />
                      <SortableHeader
                        label="Latest value"
                        testId="sort-value"
                        align="right"
                        active={sortKey === 'value'}
                        dir={sortDir}
                        onSort={() => toggle('value')}
                      />
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((r) => (
                      <TimeDepositListRow
                        key={r.item.investment.id}
                        item={r.item}
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
