import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/SortableHeader'
import { ListHeadline } from '@/components/ListHeadline'
import { ShowInactiveToggle } from '@/components/ShowInactiveToggle'
import { useVehicles } from '@/hooks/useVehicles'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { useTableSort, type ColumnSort } from '@/hooks/useTableSort'
import { CreateVehicleDialog } from '@/components/CreateVehicleDialog'
import { VehicleListRow } from '@/components/VehicleListRow'
import { ownershipLabel } from '@/lib/ownership'
import { isActiveStatus, statusLabel } from '@/lib/lifecycle'
import { activeCurrencyTotals } from '@/lib/totals'
import { byNumberNullsLast, byText } from '@/lib/sort'
import type { VehicleListItem } from '@/api/types'

type Props = {
  onSelect: (id: string) => void
}

type SortKey = 'name' | 'ownership' | 'status' | 'value'

type Row = {
  item: VehicleListItem
  ownerLabel: string
  name: string
  status: string
  statusText: string
  amount: number | null
}

const tiebreakByName = (a: Row, b: Row) => a.name.localeCompare(b.name)

export function VehiclesScreen({ onSelect }: Props) {
  const { data, isPending, error } = useVehicles()
  const { data: members } = useHouseholdMembers()
  const { data: currentUser } = useSession()
  const [showInactive, setShowInactive] = useState(false)

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
        statusText: statusLabel('assets', item.asset.status),
        amount: item.latest_snapshot ? Number(item.latest_snapshot.amount) : null,
      })),
    [data, members, currentUser],
  )

  const columns = useMemo<Record<SortKey, ColumnSort<Row>>>(
    () => ({
      name: { dir: 'asc', cmp: byText((r) => r.name) },
      ownership: { dir: 'asc', cmp: byText((r) => r.ownerLabel) },
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
  const visibleRows = showInactive
    ? sorted
    : sorted.filter((r) => isActiveStatus(r.status))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Track monthly valuations across the household's vehicles.
          </p>
        </div>
        <CreateVehicleDialog />
      </div>

      <ListHeadline
        totals={totals}
        count={count}
        label="Total value"
        noun="vehicle"
        nounPlural="vehicles"
        testId="vehicles-total"
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
            <CardTitle>No vehicles yet</CardTitle>
            <CardDescription>
              Create your first vehicle to start tracking month-end valuations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateVehicleDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {terminatedCount > 0 && (
            <ShowInactiveToggle
              count={terminatedCount}
              nounPlural="vehicles"
              checked={showInactive}
              onChange={setShowInactive}
            />
          )}

          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active vehicles. {terminatedCount} inactive vehicle
              {terminatedCount === 1 ? '' : 's'} hidden — tick "Show inactive
              vehicles" to {terminatedCount === 1 ? 'see it' : 'see them'}.
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
                        label="Latest valuation"
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
                      <VehicleListRow
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
