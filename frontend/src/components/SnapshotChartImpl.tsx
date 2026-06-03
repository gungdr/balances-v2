import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  formatChartMonth,
  formatCompactNumber,
  formatCurrency,
} from '@/lib/format'

// Generic snapshot shape — all four position groups (asset, liability,
// receivable, investment) have amount-shaped snapshots with year_month +
// amount, so the chart only needs these two fields.
type SnapshotLike = {
  year_month: string
  amount: string
}

type CostPoint = {
  year_month: string
  cost: number
}

type Props = {
  snapshots: SnapshotLike[]
  currency: string
  costSeries?: CostPoint[]
}

function toChartData(snapshots: SnapshotLike[], costSeries?: CostPoint[]) {
  // Cost lookup by year_month prefix — caller passes either the bare
  // "YYYY-MM" or the API's "YYYY-MM-DDT..." shape, both reduce to the
  // same key via slice(0, 7).
  const costByMonth = new Map<string, number>()
  for (const c of costSeries ?? []) {
    costByMonth.set(c.year_month.slice(0, 7), c.cost)
  }
  return [...snapshots]
    .sort((a, b) => a.year_month.localeCompare(b.year_month))
    .map((s) => {
      const month = formatChartMonth(new Date(s.year_month))
      const ym = s.year_month.slice(0, 7)
      const point: { month: string; amount: number; cost?: number } = {
        month,
        amount: Number(s.amount),
      }
      if (costByMonth.has(ym)) point.cost = costByMonth.get(ym)
      return point
    })
}

export default function SnapshotChartImpl({
  snapshots,
  currency,
  costSeries,
}: Props) {
  const { t } = useTranslation('dashboard')
  const data = toChartData(snapshots, costSeries)
  const hasCost = (costSeries ?? []).length > 0
  // ChartConfig is built per-render so the legend label picks up the active
  // locale. Cheap — single key, no per-row computation.
  const chartConfig = {
    amount: {
      label: t('chart.amountLegend'),
      color: 'var(--chart-1)',
    },
    ...(hasCost && {
      cost: {
        label: t('chart.costLegend'),
        // Muted-slate baseline (issue #14 decision): cost is a reference
        // line; gain / loss reads from the gap between value and cost,
        // not from the cost line's own color cue.
        color: 'var(--muted-foreground)',
      },
    }),
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={12}
          width={80}
          tickFormatter={(v: number) => formatCompactNumber(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                formatCurrency(String(value), currency)
              }
              labelFormatter={(label) => label}
            />
          }
        />
        <Area
          dataKey="amount"
          type="monotone"
          fill="var(--color-amount)"
          fillOpacity={0.2}
          stroke="var(--color-amount)"
          strokeWidth={2}
        />
        {hasCost && (
          <Line
            dataKey="cost"
            type="monotone"
            stroke="var(--color-cost)"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        )}
        {hasCost && <ChartLegend content={<ChartLegendContent />} />}
      </AreaChart>
    </ChartContainer>
  )
}
