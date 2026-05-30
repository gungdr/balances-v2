import { Button } from '@/components/ui/button'
import type { RiskProfile } from '@/api/types'

export type RiskProfileFilterValue = 'all' | RiskProfile

const OPTIONS: { value: RiskProfileFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

type Props = {
  value: RiskProfileFilterValue
  onChange: (next: RiskProfileFilterValue) => void
}

// Chip-bar filter mounted on each of the 5 per-subtype list screens
// (stocks/MFs/golds/bonds/TDs). Mirrors the regularity filter pattern on the
// Income screen — Button variant toggles between default (selected) and
// outline (idle).
export function RiskProfileFilter({ value, onChange }: Props) {
  return (
    <div
      className="flex gap-2"
      role="group"
      aria-label="Filter by risk profile"
    >
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={value === opt.value ? 'default' : 'outline'}
          onClick={() => onChange(opt.value)}
          data-testid={`risk-filter-${opt.value}`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
