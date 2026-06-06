import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvestmentPieChart, type PieSlice } from '@/components/InvestmentPieChart'
import { TagBadge } from '@/components/TagBadge'
import { useTags, useTagBreakdown } from '@/hooks/useTags'
import { aggregateTagBreakdown } from '@/lib/tagBreakdown'
import { formatCurrency } from '@/lib/format'

// TagsScreen is the breakdown report (ADR-0028): per currency, a pie of
// holdings proportion by Tag plus a table of holdings / liabilities / net,
// with an Untagged bucket. No FX — a multi-currency household sees one card
// per currency, matching the list/home convention.
export function TagsScreen() {
  const { t } = useTranslation(['tags', 'common'])
  const { data: tags } = useTags()
  const { data: rows, isLoading } = useTagBreakdown()

  const untaggedLabel = t('report.untagged')
  const breakdowns =
    rows && tags ? aggregateTagBreakdown(rows, tags, untaggedLabel) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('report.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('report.subtitle')}</p>
      </div>

      {!isLoading && breakdowns.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="tags-empty">
          {t('report.empty')}
        </p>
      )}

      {breakdowns.map((bd) => {
        const slices: PieSlice[] = bd.cells
          .filter((c) => c.holdings > 0)
          .map((c) => ({
            key: c.tagId ?? 'untagged',
            label: c.name,
            value: c.holdings,
            color: c.color,
          }))

        return (
          <Card key={bd.currency} data-testid={`tag-breakdown-${bd.currency}`}>
            <CardHeader>
              <CardTitle className="text-base">
                {t('report.currencyHeading', { currency: bd.currency })}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <InvestmentPieChart slices={slices} currency={bd.currency} />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('report.col.tag')}</TableHead>
                    <TableHead className="text-right">
                      {t('report.col.holdings')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('report.col.liabilities')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('report.col.net')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bd.cells.map((c) => (
                    <TableRow key={c.tagId ?? 'untagged'}>
                      <TableCell>
                        <TagBadge name={c.name} color={c.color} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.holdings > 0
                          ? formatCurrency(String(c.holdings), bd.currency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {c.liabilities > 0
                          ? `−${formatCurrency(String(c.liabilities), bd.currency)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(String(c.net), bd.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium">
                    <TableCell>{t('report.total')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(String(bd.totalHoldings), bd.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {bd.totalLiabilities > 0
                        ? `−${formatCurrency(String(bd.totalLiabilities), bd.currency)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        String(bd.totalHoldings - bd.totalLiabilities),
                        bd.currency,
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
