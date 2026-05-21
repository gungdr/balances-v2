// Maturity status + label for bond + time_deposit list rows.
//
// Four states, layered from least to most urgent:
//   default     — > 90 days to maturity. Muted, normal weight.
//                 Label: "Matures Aug 2027"
//   approaching — ≤ 90 days, not yet matured. Bold, default text color.
//                 Label: "Matures Sep 2026"
//   imminent    — ≤ 30 days, not yet matured. Bold + amber accent.
//                 Label: "Matures in 18 days"
//   matured     — past maturity_date. Muted with warning icon prefix.
//                 Label: "⚠ Matured Jul 2024"
//
// Callers map state → className. Today is computed in the user's locale
// (no time-zone juggling — the maturity_date is stored as a calendar DATE).

export type MaturityState =
  | 'default'
  | 'approaching'
  | 'imminent'
  | 'matured'

export type MaturityInfo = {
  state: MaturityState
  label: string
}

function daysBetween(a: Date, b: Date): number {
  const oneDay = 1000 * 60 * 60 * 24
  // Truncate to date-only to avoid TZ wobble on the boundaries.
  const ax = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bx = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((bx.getTime() - ax.getTime()) / oneDay)
}

function formatMonthYear(date: Date): string {
  return date.toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

export function maturityInfo(
  maturityDate: string,
  now: Date = new Date(),
): MaturityInfo {
  const m = new Date(maturityDate)
  if (Number.isNaN(m.getTime())) {
    return { state: 'default', label: '' }
  }
  const days = daysBetween(now, m)
  if (days < 0) {
    return { state: 'matured', label: `⚠ Matured ${formatMonthYear(m)}` }
  }
  if (days <= 30) {
    return {
      state: 'imminent',
      label: days === 0 ? 'Matures today' : `Matures in ${days} days`,
    }
  }
  if (days <= 90) {
    return { state: 'approaching', label: `Matures ${formatMonthYear(m)}` }
  }
  return { state: 'default', label: `Matures ${formatMonthYear(m)}` }
}

// Tailwind class fragment per state. Kept here so list rows stay terse.
export function maturityClass(state: MaturityState): string {
  switch (state) {
    case 'imminent':
      return 'text-amber-600 dark:text-amber-400 font-semibold'
    case 'approaching':
      return 'font-semibold'
    case 'matured':
      return 'text-muted-foreground'
    default:
      return 'text-muted-foreground'
  }
}
