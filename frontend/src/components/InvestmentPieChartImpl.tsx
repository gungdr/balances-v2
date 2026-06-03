import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCurrency } from '@/lib/format'
import type { PieSlice } from './InvestmentPieChart'

type Props = {
  slices: PieSlice[]
  currency: string
}

export default function InvestmentPieChartImpl({ slices, currency }: Props) {
  // Drop empty slices so the pie's `nameKey`-driven legend stays tight.
  const present = slices.filter((s) => s.value > 0)
  const total = present.reduce((s, sl) => s + sl.value, 0)

  const chartConfig: ChartConfig = Object.fromEntries(
    present.map((s) => [s.key, { label: s.label, color: s.color }]),
  )

  // Recharts' `Pie` reads `dataKey` for the wedge magnitude and
  // `nameKey` for the legend identity; we shape rows accordingly.
  const data = present.map((s) => ({
    key: s.key,
    label: s.label,
    value: s.value,
    fill: s.color,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="key"
              hideLabel
              formatter={(value, _name, item) => {
                const pct = total > 0 ? (Number(value) / total) * 100 : 0
                const amount = formatCurrency(String(value), currency)
                const label = item.payload.label as string
                return `${label}: ${amount} (${pct.toFixed(1)}%)`
              }}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius={48}
          outerRadius={88}
          paddingAngle={1}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={d.fill} stroke="var(--background)" />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="key" />} />
      </PieChart>
    </ChartContainer>
  )
}
