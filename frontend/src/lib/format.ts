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

// formatSignedPercent renders a signed-decimal rate like property's
// annual_appreciation_rate with an explicit "+" or "−" prefix and 2dp.
// "3.5"  -> "+3.50%"
// "-2"   -> "−2.00%" (real minus sign, not hyphen)
// "0"    -> "0.00%"
export function formatSignedPercent(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(2)}%`
}

// roundToCurrency rounds a decimal-string amount to the precision the currency
// displays at — 0 dp for IDR/JPY/KRW/VND, 2 dp for everything else. Used when
// pasting a computed suggestion (e.g. the revaluation helper) into a snapshot
// amount input so the field shows "19493589" for IDR rather than the helper's
// raw 4dp "19493588.6896". Returns the input unchanged on NaN.
export function roundToCurrency(amount: string, currency: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return amount
  const decimals = NO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
  const f = Math.pow(10, decimals)
  return (Math.round(n * f) / f).toFixed(decimals)
}
