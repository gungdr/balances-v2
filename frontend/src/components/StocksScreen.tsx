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
import { useStocks } from '@/hooks/useInvestments'
import { useTableSort, type ColumnSort } from '@/hooks/useTableSort'
import { CreateStockDialog } from '@/components/CreateStockDialog'
import { StockListRow } from '@/components/StockListRow'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { byNumberNullsLast, byText } from '@/lib/sort'
import type { StockListItem } from '@/api/types'

type Props = {
  onSelect: (id: string) => void
}

// Investments show a subtype-specific identifier column (here Ticker) instead
// of Ownership, and it stays a plain non-sortable header — the sortable axes
// are Name, Status, and value.
type SortKey = 'name' | 'status' | 'value'

type Row = {
  item: StockListItem
  name: string
  status: string
  statusText: string
  amount: number | null
}

const tiebreakByName = (a: Row, b: Row) => a.name.localeCompare(b.name)

export function StocksScreen({ onSelect }: Props) {
  const { data, isPending, error } = useStocks()
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
          <h1 className="text-2xl font-semibold tracking-tight">Stocks</h1>
          <p className="text-sm text-muted-foreground">
            Listed equities — tracked by ticker and exchange, with monthly
            quantity-and-price snapshots.
          </p>
        </div>
        <CreateStockDialog />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label="Total value"
        noun="position"
        nounPlural="positions"
        testId="stocks-total"
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
            <CardTitle>No stock positions yet</CardTitle>
            <CardDescription>
              Create your first stock position to start tracking month-end
              quantity and price.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateStockDialog />
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
                      <TableHead>Ticker</TableHead>
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
                      <StockListRow
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
