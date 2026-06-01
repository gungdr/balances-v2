import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SnapshotChart } from '@/components/SnapshotChart'
import { MonthPickerPopover } from '@/components/MonthPickerPopover'
import { useReports, useRebuildReports } from '@/hooks/useReports'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useFxRates } from '@/hooks/useFxRates'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatNumber, formatYearMonth } from '@/lib/format'
import { preferredName } from '@/lib/names'
import {
  availableDisplayCurrencies,
  resolveDisplayRate,
  convert,
} from '@/lib/fx'
import type { FxRate, HouseholdMember, MonthlyReport } from '@/api/types'
import type { Me } from '@/hooks/useSession'

// The net-worth dashboard — the app's home tab. Single-scroll, headline-first
// (M5 grilling): big net-worth number + trend, then the time-series, then a
// group breakdown, then by-person. The income-statement panel arrives in M5
// slice 2; this slice is net worth only.

export function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common'])
  const { data: reports, isPending, error } = useReports()
  const { data: members } = useHouseholdMembers()
  const { data: rates } = useFxRates()
  const { data: me } = useSession()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  // Q15c: a second display currency under the headline. Local-only state; off
  // by default. Offered only to multi-currency households that have ≥1 rate.
  const [secondaryCurrency, setSecondaryCurrency] = useState('')

  if (isPending) {
    return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        {t('loadFailed', { message: (error as Error).message })}
      </p>
    )
  }
  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('empty.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('empty.body')}</p>
        </CardContent>
      </Card>
    )
  }

  // Selection defaults to the most recent (current, in-progress) month.
  const latest = reports[reports.length - 1]
  const selected =
    reports.find((r) => r.year_month === selectedMonth) ?? latest
  const selectedIdx = reports.indexOf(selected)
  const previous = selectedIdx > 0 ? reports[selectedIdx - 1] : null
  const isProvisional = selected === latest
  const currency = selected.reporting_currency

  // Side-by-side currencies the user can pick (multi-currency households only).
  const displayCurrencies = me?.multi_currency_enabled
    ? availableDisplayCurrencies(rates ?? [], currency)
    : []
  // Guard against a stale selection (e.g. its rate was deleted): fall back to off.
  const secondary = displayCurrencies.includes(secondaryCurrency)
    ? secondaryCurrency
    : ''

  return (
    <div className="space-y-6">
      <DashboardHeader
        reports={reports}
        selected={selected}
        onSelect={setSelectedMonth}
        displayCurrencies={displayCurrencies}
        secondary={secondary}
        onSecondaryChange={setSecondaryCurrency}
      />

      <HeadlineCard
        selected={selected}
        previous={previous}
        isProvisional={isProvisional}
        currency={currency}
        secondary={secondary}
        rates={rates ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('chart.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SnapshotChart
            snapshots={reports.map((r) => ({
              year_month: r.year_month,
              amount: r.nw_total,
            }))}
            currency={currency}
          />
        </CardContent>
      </Card>

      <GroupBreakdown selected={selected} currency={currency} />

      <ExchangeRates selected={selected} currency={currency} />

      <ThisMonth selected={selected} currency={currency} />

      <ByPerson
        selected={selected}
        currency={currency}
        members={members}
        me={me}
      />

      <RebuildFooter selected={selected} />
    </div>
  )
}

// RebuildFooter offers the manual rebuild actions (ADR-0006). Framed in
// user terms ("numbers look off?") rather than the engine-cache reason, and
// kept deliberately low-key at the page bottom — a maintenance affordance, not
// a primary action. Rebuild-month is the surgical fix; rebuild-all re-derives
// every month (needed after an exchange-rate correction ripples across history).
function RebuildFooter({ selected }: { selected: MonthlyReport }) {
  const { t } = useTranslation('dashboard')
  const { rebuildAll, rebuildMonth } = useRebuildReports()
  const busy = rebuildAll.isPending || rebuildMonth.isPending
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
      <span>{t('rebuild.prompt')}</span>
      <button
        type="button"
        className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        disabled={busy}
        onClick={() => rebuildMonth.mutate(selected.year_month)}
      >
        {rebuildMonth.isPending
          ? t('rebuild.rebuilding')
          : t('rebuild.rebuildMonth', { when: formatYearMonth(selected.year_month) })}
      </button>
      {/* Typographic separator glyph; locale-neutral. */}
      <span aria-hidden>{'·'}</span>
      <button
        type="button"
        className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        disabled={busy}
        onClick={() => rebuildAll.mutate()}
      >
        {rebuildAll.isPending ? t('rebuild.rebuilding') : t('rebuild.rebuildAll')}
      </button>
      {(rebuildAll.isError || rebuildMonth.isError) && (
        <span className="text-destructive">{t('rebuild.failed')}</span>
      )}
    </div>
  )
}

function DashboardHeader({
  reports,
  selected,
  onSelect,
  displayCurrencies,
  secondary,
  onSecondaryChange,
}: {
  reports: MonthlyReport[]
  selected: MonthlyReport
  onSelect: (yearMonth: string) => void
  displayCurrencies: string[]
  secondary: string
  onSecondaryChange: (currency: string) => void
}) {
  const { t } = useTranslation('dashboard')
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <div className="flex items-center gap-2">
        {displayCurrencies.length > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {t('secondary.label')}
            <select
              data-testid="dashboard-secondary-currency"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={secondary}
              onChange={(e) => onSecondaryChange(e.target.value)}
            >
              <option value="">{t('secondary.none')}</option>
              {displayCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <MonthPickerPopover
          reports={reports}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

function HeadlineCard({
  selected,
  previous,
  isProvisional,
  currency,
  secondary,
  rates,
}: {
  selected: MonthlyReport
  previous: MonthlyReport | null
  isProvisional: boolean
  currency: string
  secondary: string
  rates: FxRate[]
}) {
  const { t } = useTranslation('dashboard')
  const staleCount = selected.stale_positions.length
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-4xl font-semibold tracking-tight">
            {formatCurrency(selected.nw_total, currency)}
          </span>
          <Trend selected={selected} previous={previous} currency={currency} />
          {isProvisional && (
            <span className="text-xs text-muted-foreground">
              {'· '}
              {t('headline.inProgress')}
            </span>
          )}
        </div>
        {secondary && (
          <SecondaryAmount selected={selected} currency={secondary} rates={rates} />
        )}
        {staleCount > 0 && (
          <p className="text-sm text-amber-600">
            {t('headline.stalePositions', {
              count: staleCount,
              when: formatYearMonth(selected.year_month),
            })}
          </p>
        )}
        <MissingFxWarning selected={selected} />
      </CardContent>
    </Card>
  )
}

function MissingFxWarning({ selected }: { selected: MonthlyReport }) {
  const { t } = useTranslation('dashboard')
  if (selected.missing_fx.length === 0) return null
  const currencies = [...new Set(selected.missing_fx.map((m) => m.currency))]
  const count = selected.missing_fx.filter((m) => m.position_id !== null).length
  const subject =
    count > 0
      ? t('missingFx.positions', { count })
      : t('missingFx.someAmounts')
  const addRate = t('missingFx.addRate', { count: currencies.length })
  return (
    <p className="text-sm text-destructive">
      {t('missingFx.line', {
        subject,
        when: formatYearMonth(selected.year_month),
        currencies: currencies.join(', '),
        addRate,
      })}
    </p>
  )
}

// SecondaryAmount projects the headline net worth into a second currency
// (Q15c, ADR-0010) at the selected month's carry-forward rate. Pure rendering;
// shown as an "≈" approximation since the conversion is display-only. Flags when
// the rate is carried forward from an earlier month, or absent entirely.
function SecondaryAmount({
  selected,
  currency,
  rates,
}: {
  selected: MonthlyReport
  currency: string
  rates: FxRate[]
}) {
  const { t } = useTranslation('dashboard')
  const resolved = resolveDisplayRate(rates, currency, selected.year_month)
  if (!resolved) {
    return (
      <p data-testid="dashboard-secondary-amount" className="text-sm text-muted-foreground">
        {t('secondary.noRate', { currency })}
      </p>
    )
  }
  const amount = convert(selected.nw_total, resolved.rate)
  const carried =
    resolved.rateMonth.slice(0, 7) !== selected.year_month.slice(0, 7)
  return (
    <p data-testid="dashboard-secondary-amount" className="text-sm text-muted-foreground tabular-nums">
      {'≈ '}
      {formatCurrency(String(amount), currency)}
      {carried && (
        <span className="ml-1 text-amber-600">
          {'· '}
          {t('secondary.carriedForward', {
            currency,
            from: formatYearMonth(resolved.rateMonth),
          })}
        </span>
      )}
    </p>
  )
}

function Trend({
  selected,
  previous,
  currency,
}: {
  selected: MonthlyReport
  previous: MonthlyReport | null
  currency: string
}) {
  const { t } = useTranslation('dashboard')
  if (!previous) {
    return (
      <span className="text-sm text-muted-foreground">
        {t('headline.firstTrackedMonth')}
      </span>
    )
  }
  // Display-only arithmetic at household scale (see lib/format.ts). The signed
  // month-over-month change becomes a backend figure (ΔNW) in M5 slice 2.
  const delta = Number(selected.nw_total) - Number(previous.nw_total)
  const prevAbs = Math.abs(Number(previous.nw_total))
  const pct = prevAbs > 0 ? (delta / prevAbs) * 100 : null
  const up = delta >= 0
  return (
    <span className={`text-sm font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
      {up ? '▲' : '▼'} {formatCurrency(String(Math.abs(delta)), currency)}
      {pct !== null && ` (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)`}{' '}
      <span className="font-normal text-muted-foreground">
        {t('headline.vs', { when: formatYearMonth(previous.year_month) })}
      </span>
    </span>
  )
}

function GroupBreakdown({
  selected,
  currency,
}: {
  selected: MonthlyReport
  currency: string
}) {
  const { t } = useTranslation('dashboard')
  // labelKey indexes the `breakdown` group in the dashboard catalog so the row
  // strings translate without scattering the array; structural shape stays
  // the same as the original.
  const rows = [
    { labelKey: 'breakdown.assets', value: Number(selected.nw_assets), negative: false },
    { labelKey: 'breakdown.investments', value: Number(selected.nw_investments), negative: false },
    { labelKey: 'breakdown.receivables', value: Number(selected.nw_receivables), negative: false },
    { labelKey: 'breakdown.liabilities', value: Number(selected.nw_liabilities), negative: true },
  ]
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('breakdown.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.labelKey} className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <span className="text-sm text-muted-foreground">{t(r.labelKey)}</span>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full ${r.negative ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
              <span className="w-40 text-right text-sm tabular-nums">
                {r.negative && r.value > 0 ? '−' : ''}
                {formatCurrency(String(r.value), currency)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ByPerson({
  selected,
  currency,
  members,
  me,
}: {
  selected: MonthlyReport
  currency: string
  members: HouseholdMember[] | undefined
  me: Me | null | undefined
}) {
  const { t } = useTranslation('dashboard')
  const entries = Object.entries(selected.user_breakdowns).sort(
    ([, a], [, b]) => Number(b.nw) - Number(a.nw),
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('byPerson.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {entries.map(([key, bucket]) => (
            <div key={key}>
              <div className="text-sm text-muted-foreground">
                {personLabel(t, key, members, me)}
              </div>
              <div className="text-lg font-medium tabular-nums">
                {formatCurrency(bucket.nw, currency)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ExchangeRates shows the rates applied this month (fx_rates_used) — only when
// the household is multi-currency and a foreign currency was converted.
function ExchangeRates({
  selected,
  currency,
}: {
  selected: MonthlyReport
  currency: string
}) {
  const { t } = useTranslation('dashboard')
  const entries = Object.entries(selected.fx_rates_used)
  if (entries.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fxThisMonth.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cur, rate]) => (
              <div key={cur} className="tabular-nums">
                {t('fxThisMonth.line', {
                  base: cur,
                  rate: formatNumber(rate),
                  quote: currency,
                })}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ThisMonth renders the comprehensive-income statement (ADR-0008): earned
// income + investment return + property/vehicle value change − living expenses
// = net worth change. Suppressed on the first-month baseline (derived lines
// null — no prior month to compare).
function ThisMonth({
  selected,
  currency,
}: {
  selected: MonthlyReport
  currency: string
}) {
  const { t } = useTranslation('dashboard')
  const baseline = selected.derived_living_expenses === null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('thisMonth.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {baseline ? (
          <p className="text-sm text-muted-foreground">{t('thisMonth.baseline')}</p>
        ) : (
          <IncomeStatement selected={selected} currency={currency} />
        )}
      </CardContent>
    </Card>
  )
}

function IncomeStatement({
  selected,
  currency,
}: {
  selected: MonthlyReport
  currency: string
}) {
  const { t } = useTranslation('dashboard')
  // Display-only arithmetic at household scale (see lib/format.ts). Each line
  // is its signed contribution to net-worth change, so they sum to the total.
  const earned = Number(selected.earned_income_total ?? '0')
  const ret = Number(selected.investment_return_total ?? '0')
  const avc = Number(selected.asset_value_change ?? '0')
  const exp = Number(selected.derived_living_expenses ?? '0')
  const nwChange = earned + ret + avc - exp
  const expensePositive = exp >= 0

  return (
    <div className="space-y-2 text-sm">
      <StatementRow label={t('statement.earned')} value={earned} currency={currency} />
      <StatementRow label={t('statement.investmentReturn')} value={ret} currency={currency} />
      {avc !== 0 && (
        <StatementRow
          label={t('statement.assetValueChange')}
          value={avc}
          currency={currency}
          muted
          hint={t('statement.assetValueChangeHint')}
        />
      )}
      <StatementRow
        // The residual: positive → spending (an outflow); negative → net worth
        // rose more than income + return explain (relabelled, shown as a gain).
        label={expensePositive ? t('statement.livingExpenses') : t('statement.unexplainedIncrease')}
        value={-exp}
        currency={currency}
        hint={
          expensePositive
            ? t('statement.livingExpensesHint')
            : t('statement.unexplainedIncreaseHint')
        }
      />
      <div className="border-t pt-2">
        <StatementRow
          label={t('statement.nwChange')}
          value={nwChange}
          currency={currency}
          bold
        />
      </div>
    </div>
  )
}

function StatementRow({
  label,
  value,
  currency,
  muted,
  bold,
  hint,
}: {
  label: string
  value: number
  currency: string
  muted?: boolean
  bold?: boolean
  hint?: string
}) {
  const positive = value >= 0
  const amountClass = muted
    ? 'text-muted-foreground'
    : positive
      ? 'text-emerald-600'
      : 'text-destructive'
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted ? 'text-muted-foreground' : ''} title={hint}>
        {label}
        {hint && <span className="ml-1 cursor-help text-muted-foreground">{'ⓘ'}</span>}
      </span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${amountClass}`}>
        {positive ? '+' : '−'}
        {formatCurrency(String(Math.abs(value)), currency)}
      </span>
    </div>
  )
}

// personLabel resolves a user_breakdowns key to a display name: "joint" → the
// Joint column; a user_id → that member's name with "(you)" for the current
// user. Mirrors lib/ownership.ts but keyed by the breakdown's user_id. Takes
// `t` so call sites stay hook-free.
function personLabel(
  t: TFunction,
  key: string,
  members: HouseholdMember[] | undefined,
  me: Me | null | undefined,
): string {
  if (key === 'joint') return t('byPerson.joint')
  const m = (members ?? []).find((x) => x.id === key)
  if (!m) return t('byPerson.unknown')
  return me && m.id === me.id
    ? `${preferredName(m)}${t('byPerson.youSuffix')}`
    : preferredName(m)
}
