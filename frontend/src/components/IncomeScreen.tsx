import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

// Filter values are stable enum keys; labels resolve at render via t() so the
// chip-bar localises with the rest of the screen.
const FILTER_VALUES: RegularityFilter[] = ['all', 'routine', 'incidental']

export function IncomeScreen() {
  const { t } = useTranslation(['income', 'common', 'errors'])
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

  // The filter-empty line picks one of three messages so the noun reads
  // naturally in either locale rather than interpolating a raw "all" / "rutin"
  // keyword into a generic frame.
  const emptyKey =
    regularityFilter === 'routine'
      ? 'income:filter.emptyRoutine'
      : regularityFilter === 'incidental'
        ? 'income:filter.emptyIncidental'
        : 'income:filter.emptyAll'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('income:listTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('income:listSubtitle')}
          </p>
        </div>
        <CreateIncomeDialog />
      </div>

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
            <CardTitle>{t('income:emptyTitle')}</CardTitle>
            <CardDescription>{t('income:emptyBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateIncomeDialog />
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          <div
            className="flex gap-2"
            role="group"
            aria-label={t('income:filter.ariaLabel')}
          >
            {FILTER_VALUES.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={regularityFilter === value ? 'default' : 'outline'}
                onClick={() => {
                  setRegularityFilter(value)
                  setPage(1)
                }}
                data-testid={`regularity-filter-${value}`}
              >
                {t(`income:filter.${value}`)}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('income:tableHeaders.date')}</TableHead>
                      <TableHead>{t('income:tableHeaders.category')}</TableHead>
                      <TableHead>{t('income:tableHeaders.amount')}</TableHead>
                      <TableHead>
                        {t('income:tableHeaders.description')}
                      </TableHead>
                      <TableHead>
                        {t('income:tableHeaders.ownership')}
                      </TableHead>
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
