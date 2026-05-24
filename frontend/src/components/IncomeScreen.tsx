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
import { useIncome } from '@/hooks/useIncome'
import { CreateIncomeDialog } from '@/components/CreateIncomeDialog'
import { IncomeRow } from '@/components/IncomeRow'
import { PaginationControls } from '@/components/PaginationControls'

const PAGE_SIZE = 12

export function IncomeScreen() {
  const { data, isPending, error } = useIncome()
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil((data?.length ?? 0) / PAGE_SIZE))
  const effectivePage = Math.min(page, totalPages)
  const pageRows = (data ?? []).slice(
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
  )
}
