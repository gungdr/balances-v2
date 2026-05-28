import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/SortableHeader'
import { ListHeadline } from '@/components/ListHeadline'
import { ShowInactiveToggle } from '@/components/ShowInactiveToggle'
import { useLiabilities } from '@/hooks/useLiabilities'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { useTableSort, type ColumnSort } from '@/hooks/useTableSort'
import { CreateLiabilityDialog } from '@/components/CreateLiabilityDialog'
import { LiabilityListRow } from '@/components/LiabilityListRow'
import { ownershipLabel } from '@/lib/ownership'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { byNumberNullsLast, byText } from '@/lib/sort'
import type { LiabilityListItem } from '@/api/types'

type Props = {
  subtype: 'personal' | 'institutional'
  onSelect: (id: string) => void
}

const COPY = {
  personal: {
    title: 'Personal Liabilities',
    description:
      'Informal debts — money owed to family, friends, or other individuals.',
  },
  institutional: {
    title: 'Institutional Liabilities',
    description:
      'Formal debts — mortgages, bank loans, outstanding credit-card balances.',
  },
} as const

type SortKey = 'name' | 'ownership' | 'status' | 'balance'

type Row = {
  item: LiabilityListItem
  ownerLabel: string
  name: string
  status: string
  statusText: string
  amount: number | null
}

const tiebreakByName = (a: Row, b: Row) => a.name.localeCompare(b.name)

export function LiabilitiesScreen({ subtype, onSelect }: Props) {
  const { data, isPending, error } = useLiabilities(subtype)
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const [showInactive, setShowInactive] = useState(false)
  const copy = COPY[subtype]

  const rows = useMemo<Row[]>(
    () =>
      (data ?? []).map((item) => ({
        item,
        ownerLabel: ownershipLabel(
          item.liability.ownership_type,
          item.liability.sole_owner_user_id,
          members,
          currentUser,
        ),
        name: item.liability.display_name,
        status: item.liability.status,
        statusText: statusLabel('liabilities', item.liability.status),
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
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <CreateLiabilityDialog defaultSubtype={subtype} />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label="Total owed"
        noun="liability"
        nounPlural="liabilities"
        testId="liabilities-total"
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
            <CardTitle>No {subtype} liabilities yet</CardTitle>
            <CardDescription>
              Create your first {subtype} liability to start tracking month-end
              balances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateLiabilityDialog defaultSubtype={subtype} />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {terminatedCount > 0 && (
            <ShowInactiveToggle
              count={terminatedCount}
              nounPlural="liabilities"
              checked={showInactive}
              onChange={setShowInactive}
            />
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active liabilities. {terminatedCount} inactive
              {terminatedCount === 1 ? ' liability' : ' liabilities'} hidden —
              tick "Show inactive liabilities" to{' '}
              {terminatedCount === 1 ? 'see it' : 'see them'}.
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
                      <LiabilityListRow
                        key={r.item.liability.id}
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
