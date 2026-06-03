// Shared cost / P/L stat row rendered just below the H1 subtitle on each
// investment detail screen (issue #14, slice 14b). Sits as a single
// horizontal flex row so the page header stays compact.
//
// "Latest value" is deliberately omitted — it's already prominent in the
// snapshots card; repeating it here would clutter the headline. The
// numbers shown are the two new-to-the-user signals: how much they put
// in, and whether they're up or down.
//
// **Sold-position short-circuit.** A sold position whose latest snapshot
// is the end-of-month after the sale reads value=0 (cash already left
// the position) and would render a misleading −100% P/L against cost.
// The user-driven Sell + manual terminate flow doesn't auto-create a
// snapshot at the sale month, so we suppress the P/L line for sold
// positions and surface "Sold on {date}" instead. **Matured positions
// don't take this branch** — issue #17 makes Maturity auto-upsert a
// snapshot with the realized payout, so P/L is accurate against the
// payout value.

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
  // When set to 'sold' with a terminated_at, swaps the P/L block for
  // "Sold on {date}". Pass `investment.status` + `investment.terminated_at`.
  // Matured positions don't take this branch (see file header).
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

  const isSold = !!(status === 'sold' && terminatedAt)
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
      {isSold ? (
        <div data-testid="investment-headline-closed">
          <span className="text-muted-foreground">
            {t('headline.closed.sold')}
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
