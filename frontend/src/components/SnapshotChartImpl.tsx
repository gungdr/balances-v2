import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format'

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

const chartConfig = {
  amount: {
    label: 'Amount',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

function toChartData(snapshots: SnapshotLike[]) {
  return [...snapshots]
    .sort((a, b) => a.year_month.localeCompare(b.year_month))
    .map((s) => {
      const d = new Date(s.year_month)
      const monthLabel = d.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })
      return {
        month: monthLabel,
        amount: Number(s.amount),
      }
    })
}

export default function SnapshotChartImpl({ snapshots, currency }: Props) {
  const data = toChartData(snapshots)

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
          tickFormatter={(v: number) =>
            new Intl.NumberFormat('id-ID', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(v)
          }
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
