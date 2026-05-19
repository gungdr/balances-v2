// Currency-aware display formatting. IDR (and JPY etc.) display with no
// decimals; most other currencies with 2. The amount comes in as a string
// for precision; for display we convert through Number which is fine at
// household scale but would need a decimal library if we ever do arithmetic
// on these values in the frontend (don't — let the backend compute).

const NO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND'])

export function formatCurrency(amount: string, currency: string): string {
  const n = Number(amount)
  if (Number.isNaN(n)) return amount
  const decimals = NO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

// "2024-05-01T00:00:00Z" -> "May 2024"
export function formatYearMonth(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

// "2024-05-31T00:00:00Z" -> "31 May 2024"
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
