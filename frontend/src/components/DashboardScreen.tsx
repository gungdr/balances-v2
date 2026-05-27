import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SnapshotChart } from '@/components/SnapshotChart'
import { useReports } from '@/hooks/useReports'
import { useHouseholdMembers } from '@/hooks/useHouseholdMembers'
import { useSession } from '@/hooks/useSession'
import { formatCurrency, formatYearMonth } from '@/lib/format'
import type { HouseholdMember, MonthlyReport } from '@/api/types'
import type { Me } from '@/hooks/useSession'

// The net-worth dashboard — the app's home tab. Single-scroll, headline-first
// (M5 grilling): big net-worth number + trend, then the time-series, then a
// group breakdown, then by-person. The income-statement panel arrives in M5
// slice 2; this slice is net worth only.

export function DashboardScreen() {
  const { data: reports, isPending, error } = useReports()
  const { data: members } = useHouseholdMembers()
  const { data: me } = useSession()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load: {(error as Error).message}
      </p>
    )
  }
  if (!reports || reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No net worth to show yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Record a snapshot on any position — a bank account balance, a
            property value — and your net worth will appear here, tracked
            month by month.
          </p>
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

  return (
    <div className="space-y-6">
      <DashboardHeader
        reports={reports}
        selected={selected}
        onSelect={setSelectedMonth}
      />

      <HeadlineCard
        selected={selected}
        previous={previous}
        isProvisional={isProvisional}
        currency={currency}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net worth over time</CardTitle>
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

      <ByPerson
        selected={selected}
        currency={currency}
        members={members}
        me={me}
      />
    </div>
  )
}

function DashboardHeader({
  reports,
  selected,
  onSelect,
}: {
  reports: MonthlyReport[]
  selected: MonthlyReport
  onSelect: (yearMonth: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Net Worth</h1>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={selected.year_month}
        onChange={(e) => onSelect(e.target.value)}
      >
        {[...reports].reverse().map((r) => (
          <option key={r.year_month} value={r.year_month}>
            {formatYearMonth(r.year_month)}
          </option>
        ))}
      </select>
    </div>
  )
}

function HeadlineCard({
  selected,
  previous,
  isProvisional,
  currency,
}: {
  selected: MonthlyReport
  previous: MonthlyReport | null
  isProvisional: boolean
  currency: string
}) {
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
            <span className="text-xs text-muted-foreground">· in progress</span>
          )}
        </div>
        {staleCount > 0 && (
          <p className="text-sm text-amber-600">
            ⚠ {staleCount} position{staleCount > 1 ? 's' : ''} carried forward —
            record {formatYearMonth(selected.year_month)} snapshot
            {staleCount > 1 ? 's' : ''} to keep this up to date.
          </p>
        )}
      </CardContent>
    </Card>
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
  if (!previous) {
    return (
      <span className="text-sm text-muted-foreground">first tracked month</span>
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
        vs {formatYearMonth(previous.year_month)}
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
  const rows = [
    { label: 'Assets', value: Number(selected.nw_assets), negative: false },
    { label: 'Investments', value: Number(selected.nw_investments), negative: false },
    { label: 'Receivables', value: Number(selected.nw_receivables), negative: false },
    { label: 'Liabilities', value: Number(selected.nw_liabilities), negative: true },
  ]
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where it&apos;s held</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[8rem_1fr] items-center gap-3">
            <span className="text-sm text-muted-foreground">{r.label}</span>
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
  const entries = Object.entries(selected.user_breakdowns).sort(
    ([, a], [, b]) => Number(b.nw) - Number(a.nw),
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">By person</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {entries.map(([key, bucket]) => (
            <div key={key}>
              <div className="text-sm text-muted-foreground">
                {personLabel(key, members, me)}
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

// personLabel resolves a user_breakdowns key to a display name: "joint" → the
// Joint column; a user_id → that member's name with "(you)" for the current
// user. Mirrors lib/ownership.ts but keyed by the breakdown's user_id.
function personLabel(
  key: string,
  members: HouseholdMember[] | undefined,
  me: Me | null | undefined,
): string {
  if (key === 'joint') return 'Joint'
  const m = (members ?? []).find((x) => x.id === key)
  if (!m) return 'Unknown'
  return me && m.id === me.id ? `${m.display_name} (you)` : m.display_name
}
