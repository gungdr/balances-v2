import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
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

type Props = {
  snapshots: SnapshotLike[]
  currency: string
}

function toChartData(snapshots: SnapshotLike[]) {
  return [...snapshots]
    .sort((a, b) => a.year_month.localeCompare(b.year_month))
    .map((s) => ({
      month: formatChartMonth(new Date(s.year_month)),
      amount: Number(s.amount),
    }))
}

export default function SnapshotChartImpl({ snapshots, currency }: Props) {
  const { t } = useTranslation('dashboard')
  const data = toChartData(snapshots)
  // ChartConfig is built per-render so the legend label picks up the active
  // locale. Cheap — single key, no per-row computation.
  const chartConfig = {
    amount: {
      label: t('chart.amountLegend'),
      color: 'var(--chart-1)',
    },
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
      </AreaChart>
    </ChartContainer>
  )
}
