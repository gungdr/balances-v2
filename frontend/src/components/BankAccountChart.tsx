import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format'
import type { AssetSnapshot } from '@/api/types'

type Props = {
  snapshots: AssetSnapshot[]
  currency: string
}

const chartConfig = {
  balance: {
    label: 'Balance',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

// Build the chart data: sort snapshots ascending by year_month, project to
// the shape Recharts expects, with a short month label on the x-axis and the
// numeric amount on the y-axis. The formatted-currency value comes through
// to the tooltip via formatter.
function toChartData(snapshots: AssetSnapshot[]) {
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
        balance: Number(s.amount),
      }
    })
}

export function BankAccountChart({ snapshots, currency }: Props) {
  if (snapshots.length === 0) return null
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
          dataKey="balance"
          type="monotone"
          fill="var(--color-balance)"
          fillOpacity={0.2}
          stroke="var(--color-balance)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
