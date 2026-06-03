// Investments landing page (issue #14 slice 14d).
//
// Aggregates across all 5 subtypes (stock / mutual fund / bond / time
// deposit / gold) into one set of per-currency cards:
//   1. Cross-subtype Value / Cost / P/L headline.
//   2. Value + cost over time (one card per currency).
//   3. 100% stacked category share over time (one card per currency).
//   4. Two pies side-by-side per currency — category share + risk
//      profile share.
//
// **No FX.** Mirrors the 14c list-screen convention: each currency
// renders its own set of charts.
//
// **Active-only.** Terminated positions drop out of every output, same
// as `aggregateListPositions`.
//
// The N-parallel-fetch pattern is the same one used by the per-list
// screens; the structural fix (backend cost_basis aggregate) lives in
// issue #18 — applies here multiplied by 5 subtypes.

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InvestmentListHeadline } from '@/components/InvestmentListHeadline'
import { SnapshotChart } from '@/components/SnapshotChart'
import { CategoryStackChart } from '@/components/CategoryStackChart'
import {
  InvestmentPieChart,
  type PieSlice,
} from '@/components/InvestmentPieChart'
import {
  useBonds,
  useGolds,
  useMutualFunds,
  useStocks,
  useTimeDeposits,
} from '@/hooks/useInvestments'
import {
  useInvestmentBatchSnapshots,
  useInvestmentBatchTransactions,
} from '@/hooks/useInvestmentBatch'
import {
  computeCostBasis,
  costBasisSeries,
  flatCostSeries,
} from '@/lib/costBasis'
import {
  aggregateHomePositions,
  INVESTMENT_CATEGORIES,
  INVESTMENT_RISK_PROFILES,
  type HomePosition,
  type InvestmentCategory,
  type InvestmentRiskProfile,
} from '@/lib/homeAggregates'

// Mirror of CATEGORY_FILLS in CategoryStackChartImpl so the pie matches
// the stacked area visually. Kept duplicated rather than re-exported so
// each impl module stays self-contained for lazy-loading.
const CATEGORY_FILLS: Record<InvestmentCategory, string> = {
  stock: '#06b6d4',
  mutualFund: '#8b5cf6',
  bond: '#3b82f6',
  timeDeposit: '#10b981',
  gold: '#eab308',
}

// Risk pie: semantic traffic-light. Low = emerald (matches the gain
// tone), medium = amber, high = a red close to the `--destructive`
// token (the actual CSS var is OKLCH so we use a Tailwind red-500
// hex here for a stable static-fill that recharts can consume).
const RISK_FILLS: Record<InvestmentRiskProfile, string> = {
  low: '#059669', // emerald-600 (matches text-emerald-600 used elsewhere)
  medium: '#f59e0b', // amber-500
  high: '#dc2626', // red-600
}

export function InvestmentsHome() {
  const { t } = useTranslation(['common', 'investments', 'errors'])
  const stocks = useStocks()
  const mutualFunds = useMutualFunds()
  const bonds = useBonds()
  const timeDeposits = useTimeDeposits()
  const golds = useGolds()

  const noun = t('investments:list.noun')
  const nounPlural = t('investments:list.nounPlural')

  const allIds = useMemo<string[]>(
    () => [
      ...(stocks.data ?? []).map((it) => it.investment.id),
      ...(mutualFunds.data ?? []).map((it) => it.investment.id),
      ...(bonds.data ?? []).map((it) => it.investment.id),
      // TD doesn't need snapshots for cost basis (flat principal) but
      // it does need snapshots for the value time series; include it
      // in the snapshot batch.
      ...(timeDeposits.data ?? []).map((it) => it.investment.id),
      ...(golds.data ?? []).map((it) => it.investment.id),
    ],
    [stocks.data, mutualFunds.data, bonds.data, timeDeposits.data, golds.data],
  )

  // Transactions are needed for ledger-based cost basis on stock / MF /
  // gold and for the Bond hasBuys branch. TD positions don't consume
  // their transactions but the same query keys are shared with the
  // detail pages so the cache hits later.
  const txnIds = useMemo<string[]>(
    () => [
      ...(stocks.data ?? []).map((it) => it.investment.id),
      ...(mutualFunds.data ?? []).map((it) => it.investment.id),
      ...(bonds.data ?? []).map((it) => it.investment.id),
      ...(golds.data ?? []).map((it) => it.investment.id),
    ],
    [stocks.data, mutualFunds.data, bonds.data, golds.data],
  )

  const snapshotsBatch = useInvestmentBatchSnapshots(allIds)
  const transactionsBatch = useInvestmentBatchTransactions(txnIds)

  const positions = useMemo<HomePosition[]>(() => {
    const out: HomePosition[] = []

    for (const it of stocks.data ?? []) {
      const snaps = snapshotsBatch.byId.get(it.investment.id) ?? []
      const txns = transactionsBatch.byId.get(it.investment.id) ?? []
      out.push({
        id: it.investment.id,
        currency: it.investment.native_currency,
        status: it.investment.status,
        latestValue: it.latest_snapshot
          ? Number(it.latest_snapshot.amount)
          : null,
        cost: computeCostBasis(txns).cost,
        snapshots: snaps,
        costSeries: costBasisSeries(snaps, txns),
        category: 'stock',
        riskProfile: it.investment.risk_profile,
      })
    }

    for (const it of mutualFunds.data ?? []) {
      const snaps = snapshotsBatch.byId.get(it.investment.id) ?? []
      const txns = transactionsBatch.byId.get(it.investment.id) ?? []
      out.push({
        id: it.investment.id,
        currency: it.investment.native_currency,
        status: it.investment.status,
        latestValue: it.latest_snapshot
          ? Number(it.latest_snapshot.amount)
          : null,
        cost: computeCostBasis(txns).cost,
        snapshots: snaps,
        costSeries: costBasisSeries(snaps, txns),
        category: 'mutualFund',
        riskProfile: it.investment.risk_profile,
      })
    }

    for (const it of bonds.data ?? []) {
      const snaps = snapshotsBatch.byId.get(it.investment.id) ?? []
      const txns = transactionsBatch.byId.get(it.investment.id) ?? []
      const hasBuys = txns.some((tx) => tx.transaction_type === 'buy')
      const faceValue = Number(it.details.face_value)
      out.push({
        id: it.investment.id,
        currency: it.investment.native_currency,
        status: it.investment.status,
        latestValue: it.latest_snapshot
          ? Number(it.latest_snapshot.amount)
          : null,
        cost: hasBuys ? computeCostBasis(txns).cost : faceValue,
        snapshots: snaps,
        costSeries: hasBuys
          ? costBasisSeries(snaps, txns)
          : flatCostSeries(snaps, faceValue),
        category: 'bond',
        riskProfile: it.investment.risk_profile,
      })
    }

    for (const it of timeDeposits.data ?? []) {
      const snaps = snapshotsBatch.byId.get(it.investment.id) ?? []
      const principal = Number(it.details.principal)
      out.push({
        id: it.investment.id,
        currency: it.investment.native_currency,
        status: it.investment.status,
        latestValue: it.latest_snapshot
          ? Number(it.latest_snapshot.amount)
          : null,
        cost: principal,
        snapshots: snaps,
        costSeries: flatCostSeries(snaps, principal),
        category: 'timeDeposit',
        riskProfile: it.investment.risk_profile,
      })
    }

    for (const it of golds.data ?? []) {
      const snaps = snapshotsBatch.byId.get(it.investment.id) ?? []
      const txns = transactionsBatch.byId.get(it.investment.id) ?? []
      out.push({
        id: it.investment.id,
        currency: it.investment.native_currency,
        status: it.investment.status,
        latestValue: it.latest_snapshot
          ? Number(it.latest_snapshot.amount)
          : null,
        cost: computeCostBasis(txns).cost,
        snapshots: snaps,
        costSeries: costBasisSeries(snaps, txns),
        category: 'gold',
        riskProfile: it.investment.risk_profile,
      })
    }

    return out
  }, [
    stocks.data,
    mutualFunds.data,
    bonds.data,
    timeDeposits.data,
    golds.data,
    snapshotsBatch.byId,
    transactionsBatch.byId,
  ])

  const aggregates = useMemo(
    () => aggregateHomePositions(positions),
    [positions],
  )

  const anyPending =
    stocks.isPending ||
    mutualFunds.isPending ||
    bonds.isPending ||
    timeDeposits.isPending ||
    golds.isPending
  const firstError =
    stocks.error ??
    mutualFunds.error ??
    bonds.error ??
    timeDeposits.error ??
    golds.error

  const currencies = aggregates.byCurrency.map((c) => c.currency)

  return (
    <div className="space-y-6" data-testid="investments-home">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('common:home.investments.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('investments:home.subtitle')}
        </p>
      </div>

      {anyPending && (
        <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
      )}

      {firstError && (
        <p className="text-sm text-destructive">
          {t('errors:failedToLoad', {
            message: (firstError as Error).message,
          })}
        </p>
      )}

      <InvestmentListHeadline
        aggregates={aggregates.byCurrency}
        count={aggregates.count}
        noun={noun}
        nounPlural={nounPlural}
        testId="home-total"
      />

      {currencies.map((currency) => (
        <div key={currency} className="space-y-4">
          <ValueCostCard
            currency={currency}
            series={aggregates.timeSeriesByCurrency.get(currency) ?? []}
          />
          <CategoryStackCard
            currency={currency}
            series={aggregates.categorySeriesByCurrency.get(currency) ?? []}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <CategoryPieCard
              currency={currency}
              slices={buildCategorySlices(
                aggregates.categoryPieByCurrency.get(currency) ?? [],
                t,
              )}
            />
            <RiskPieCard
              currency={currency}
              slices={buildRiskSlices(
                aggregates.riskPieByCurrency.get(currency) ?? [],
                t,
              )}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

function buildCategorySlices(
  pie: { category: InvestmentCategory; value: number }[],
  t: TFn,
): PieSlice[] {
  return INVESTMENT_CATEGORIES.map((c) => {
    const found = pie.find((p) => p.category === c)
    return {
      key: c,
      label: t(`investments:home.categoryLabel.${c}`),
      value: found?.value ?? 0,
      color: CATEGORY_FILLS[c],
    }
  })
}

function buildRiskSlices(
  pie: { profile: InvestmentRiskProfile; value: number }[],
  t: TFn,
): PieSlice[] {
  return INVESTMENT_RISK_PROFILES.map((r) => {
    const found = pie.find((p) => p.profile === r)
    const labelKey = `investments:riskProfile.badge${r[0].toUpperCase()}${r.slice(1)}`
    return {
      key: r,
      label: t(labelKey),
      value: found?.value ?? 0,
      color: RISK_FILLS[r],
    }
  })
}

function ValueCostCard({
  currency,
  series,
}: {
  currency: string
  series: { year_month: string; value: number; cost: number }[]
}) {
  const { t } = useTranslation('investments')
  if (series.length < 2) return null
  return (
    <Card data-testid={`home-value-cost-${currency}`}>
      <CardHeader>
        <CardTitle>{t('home.valueCostChartTitle')}</CardTitle>
        <CardDescription>
          {t('home.valueCostChartDescription', { currency })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SnapshotChart
          snapshots={series.map((p) => ({
            year_month: p.year_month,
            amount: String(p.value),
          }))}
          costSeries={series.map((p) => ({
            year_month: p.year_month,
            cost: p.cost,
          }))}
          currency={currency}
        />
      </CardContent>
    </Card>
  )
}

function CategoryStackCard({
  currency,
  series,
}: {
  currency: string
  series: Parameters<typeof CategoryStackChart>[0]['series']
}) {
  const { t } = useTranslation('investments')
  if (series.length < 2) return null
  return (
    <Card data-testid={`home-category-stack-${currency}`}>
      <CardHeader>
        <CardTitle>{t('home.categoryStackTitle')}</CardTitle>
        <CardDescription>
          {t('home.categoryStackDescription', { currency })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryStackChart series={series} />
      </CardContent>
    </Card>
  )
}

function CategoryPieCard({
  currency,
  slices,
}: {
  currency: string
  slices: PieSlice[]
}) {
  const { t } = useTranslation('investments')
  if (slices.every((s) => s.value <= 0)) return null
  return (
    <Card data-testid={`home-category-pie-${currency}`}>
      <CardHeader>
        <CardTitle>{t('home.categoryPieTitle')}</CardTitle>
        <CardDescription>
          {t('home.categoryPieDescription', { currency })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvestmentPieChart slices={slices} currency={currency} />
      </CardContent>
    </Card>
  )
}

function RiskPieCard({
  currency,
  slices,
}: {
  currency: string
  slices: PieSlice[]
}) {
  const { t } = useTranslation('investments')
  if (slices.every((s) => s.value <= 0)) return null
  return (
    <Card data-testid={`home-risk-pie-${currency}`}>
      <CardHeader>
        <CardTitle>{t('home.riskPieTitle')}</CardTitle>
        <CardDescription>
          {t('home.riskPieDescription', { currency })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InvestmentPieChart slices={slices} currency={currency} />
      </CardContent>
    </Card>
  )
}
