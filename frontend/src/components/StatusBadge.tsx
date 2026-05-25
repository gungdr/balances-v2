import { statusLabel, type LifecycleGroup } from '@/lib/lifecycle'

// Small inline pill for a position's lifecycle status. Active is muted (the
// common case, not worth shouting about); any terminal status is amber so a
// closed/sold/matured position reads as distinct at a glance.
type Props = {
  group: LifecycleGroup
  status: string
}

export function StatusBadge({ group, status }: Props) {
  const active = status === 'active'
  const cls = active
    ? 'bg-muted text-muted-foreground'
    : 'bg-amber-100 text-amber-800'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {statusLabel(group, status)}
    </span>
  )
}
