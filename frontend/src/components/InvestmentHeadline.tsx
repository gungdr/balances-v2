// Shared cost / P/L stat row rendered just below the H1 subtitle on each
// investment detail screen (issue #14, slice 14b). Sits as a single
// horizontal flex row so the page header stays compact.
//
// "Latest value" is deliberately omitted — it's already prominent in the
// snapshots card; repeating it here would clutter the headline. The
// numbers shown are the two new-to-the-user signals: how much they put
// in, and whether they're up or down.
//
// **Closed-position short-circuit (matured / sold).** When the user
// snapshots end-of-month, a position that closed mid-month reads as
// value=0 (cash already returned). P/L against the unchanged cost basis
// then shows −100%, which is wrong: the principal wasn't lost, it was
// paid out. Until backend auto-snapshots on Maturity (deferred ticket),
// we suppress the P/L line entirely for closed positions and surface
// "Matured on {date}" / "Sold on {date}" instead.

import { useTranslation } from 'react-i18next'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  currency: string
  // Latest snapshot's amount (already in native currency). Null when
  // there are no snapshots yet.
  latestValue: number | null
  // Cost basis as of "now" — caller computes via lib/costBasis based on
  // subtype quirks (ledger replay for stock/MF/gold/bond-secondary; flat
  // face_value for bond govt-primary; flat principal for time deposit).
  totalCost: number
  // When set, swaps the P/L block for a "{statusLabel} on {date}" hint.
  // Pass `investment.status` for the label and `investment.terminated_at`
  // for the date. Both must be non-null for the swap; otherwise the P/L
  // block renders as usual.
  status?: string | null
  terminatedAt?: string | null
}

export function InvestmentHeadline({
  currency,
  latestValue,
  totalCost,
  status,
  terminatedAt,
}: Props) {
  const { t } = useTranslation('investments')

  const isClosed = !!(status && terminatedAt && status !== 'active')
  // P/L is meaningful only when we have a current value to compare cost
  // against. No snapshot → no P/L number to show.
  const pl = latestValue !== null ? latestValue - totalCost : null
  const plPct =
    pl !== null && Math.abs(totalCost) > 0 ? (pl / totalCost) * 100 : null

  return (
    <div
      className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm"
      data-testid="investment-headline"
    >
      <div>
        <span className="text-muted-foreground">
          {t('headline.totalCost')}
        </span>{' '}
        <span className="tabular-nums">
          {formatCurrency(totalCost.toString(), currency)}
        </span>
      </div>
      {isClosed ? (
        <div data-testid="investment-headline-closed">
          <span className="text-muted-foreground">
            {t(`headline.closed.${status}`, {
              defaultValue: t('headline.closed.default'),
            })}
          </span>{' '}
          <span>{formatDate(terminatedAt)}</span>
        </div>
      ) : (
        <div>
          <span className="text-muted-foreground">
            {t('headline.unrealizedPL')}
          </span>{' '}
          {pl === null ? (
            <span className="text-muted-foreground">
              {t('headline.unrealizedPLEmpty')}
            </span>
          ) : (
            <span
              className={cn('tabular-nums', plColor(pl))}
              data-testid="investment-headline-pl"
            >
              {formatPL(pl, plPct, currency)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function plColor(pl: number): string {
  if (pl > 0) return 'text-emerald-600'
  if (pl < 0) return 'text-destructive'
  return 'text-muted-foreground'
}

// `+Rp 1,234,567 (+2.34%)` / `−Rp 234,567 (−1.50%)` / `+Rp 100` (when
// cost is zero and percentage can't be computed). Signs use the minus
// glyph "−" U+2212 (not hyphen) for the same reason the revaluation
// helper does — it visually aligns with "+" on inline text.
function formatPL(pl: number, plPct: number | null, currency: string): string {
  const sign = pl > 0 ? '+' : pl < 0 ? '−' : ''
  const amount = `${sign}${formatCurrency(Math.abs(pl).toString(), currency)}`
  if (plPct === null) return amount
  const pctSign = plPct > 0 ? '+' : plPct < 0 ? '−' : ''
  return `${amount} (${pctSign}${Math.abs(plPct).toFixed(2)}%)`
}
