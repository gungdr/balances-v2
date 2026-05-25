// Position lifecycle (ADR-0009). Status enums differ per group; the backend
// (repo validatePositionLifecycle + DB CHECK) is the source of truth, this
// mirror drives the terminate dialog's dropdown and the status badge label.

export type LifecycleGroup =
  | 'assets'
  | 'liabilities'
  | 'receivables'
  | 'investments'

export type StatusOption = { value: string; label: string }

export const STATUS_OPTIONS: Record<LifecycleGroup, StatusOption[]> = {
  assets: [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'sold', label: 'Sold' },
    { value: 'disposed', label: 'Disposed' },
  ],
  liabilities: [
    { value: 'active', label: 'Active' },
    { value: 'paid_off', label: 'Paid off' },
    { value: 'forgiven', label: 'Forgiven' },
    { value: 'written_off', label: 'Written off' },
  ],
  receivables: [
    { value: 'active', label: 'Active' },
    { value: 'collected', label: 'Collected' },
    { value: 'written_off', label: 'Written off' },
  ],
  investments: [
    { value: 'active', label: 'Active' },
    { value: 'sold', label: 'Sold' },
    { value: 'matured', label: 'Matured' },
  ],
}

export function statusLabel(group: LifecycleGroup, status: string): string {
  return STATUS_OPTIONS[group].find((o) => o.value === status)?.label ?? status
}

export function isActiveStatus(status: string): boolean {
  return status === 'active'
}
