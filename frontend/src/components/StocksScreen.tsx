import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['investments', 'common', 'errors'])
  const { data, isPending, error } = useStocks()
  const [showInactive, setShowInactive] = useState(false)
  const [riskFilter, setRiskFilter] = useState<RiskProfileFilterValue>('all')

  const noun = t('investments:list.noun')
  const nounPlural = t('investments:list.nounPlural')

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('investments:stock.listTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('investments:stock.listSubtitle')}
          </p>
        </div>
        <CreateStockDialog />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label={t('investments:list.totalValue')}
        noun={noun}
        nounPlural={nounPlural}
        testId="stocks-total"
      />

      {isPending && (
        <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {t('errors:failedToLoad', { message: (error as Error).message })}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('investments:stock.emptyTitle')}</CardTitle>
            <CardDescription>
              {t('investments:stock.emptyBody')}
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
              nounPlural={nounPlural}
              checked={showInactive}
              onChange={setShowInactive}
            />
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('common:list.noActive', {
                count: terminatedCount,
                noun,
                nounPlural,
              })}
            </p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader
                        label={t('common:tableHeaders.name')}
                        testId="sort-name"
                        active={sortKey === 'name'}
                        dir={sortDir}
                        onSort={() => toggle('name')}
                      />
                      <TableHead>{t('investments:stock.tickerHeader')}</TableHead>
                      <SortableHeader
                        label={t('common:tableHeaders.status')}
                        testId="sort-status"
                        active={sortKey === 'status'}
                        dir={sortDir}
                        onSort={() => toggle('status')}
                      />
                      <SortableHeader
                        label={t('investments:stock.sortLatestValue')}
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
