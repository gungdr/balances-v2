import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { useIncome } from '@/hooks/useIncome'
import { CreateIncomeDialog } from '@/components/CreateIncomeDialog'
import { IncomeRow } from '@/components/IncomeRow'
import { PaginationControls } from '@/components/PaginationControls'
import type { Regularity } from '@/api/types'

const PAGE_SIZE = 12

type RegularityFilter = 'all' | Regularity

const FILTER_OPTIONS: { value: RegularityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'routine', label: 'Routine' },
  { value: 'incidental', label: 'Incidental' },
]

export function IncomeScreen() {
  const { data, isPending, error } = useIncome()
  const [page, setPage] = useState(1)
  const [regularityFilter, setRegularityFilter] =
    useState<RegularityFilter>('all')

  const filtered =
    regularityFilter === 'all'
      ? data ?? []
      : (data ?? []).filter((r) => r.regularity === regularityFilter)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const effectivePage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground">
            Earned cash entering your household — salary, business income,
            gifts, refunds, payouts. Investment returns are tracked separately
            on each instrument.
          </p>
        </div>
        <CreateIncomeDialog />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Failed to load: {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No income recorded yet</CardTitle>
            <CardDescription>
              Add your first income entry — typically the most recent paycheck
              or transfer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateIncomeDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2" role="group" aria-label="Filter by regularity">
            {FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={regularityFilter === opt.value ? 'default' : 'outline'}
                onClick={() => {
                  setRegularityFilter(opt.value)
                  setPage(1)
                }}
                data-testid={`regularity-filter-${opt.value}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {regularityFilter} income to show.
            </p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((row) => (
                      <IncomeRow key={row.id} income={row} />
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
