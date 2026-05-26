import { describe, it, expect } from 'vitest'
import { formatCurrency, formatYearMonth, formatDate } from '@/lib/format'

// Intl output is locale/ICU-dependent (currency glyph placement, spacing,
// digit grouping all vary by Node build), so these assert structure — the
// currency code/symbol is present, the right number of decimals appear, the
// month/year/day land — rather than pinning exact glyphs.

describe('formatCurrency', () => {
  it('renders no-decimal currencies (IDR) without a fractional part', () => {
    const out = formatCurrency('1500000', 'IDR')
    expect(out).toMatch(/Rp/)
    expect(out).not.toMatch(/[.,]\d{2}\b/) // no two-digit fraction
  })

  it('renders other no-decimal currencies (JPY, KRW, VND) without decimals', () => {
    for (const ccy of ['JPY', 'KRW', 'VND']) {
      expect(formatCurrency('1000', ccy)).not.toMatch(/[.,]\d{2}\b/)
    }
  })

  it('renders two decimals for ordinary currencies (USD)', () => {
    const out = formatCurrency('1234.5', 'USD')
    expect(out).toMatch(/\d/)
    expect(out).toMatch(/[.,]\d{2}\b/) // a two-digit fraction is present
  })

  it('returns the raw input when the amount is not a number', () => {
    expect(formatCurrency('not-a-number', 'USD')).toBe('not-a-number')
  })
})

// formatYearMonth/formatDate pin their locale ('en-US'/'en-GB') in the code,
// so exact strings are safe. Use a midday UTC timestamp so the displayed
// calendar day doesn't roll under a negative-offset runner TZ.
describe('formatYearMonth', () => {
  it('renders an ISO timestamp as long month + year', () => {
    expect(formatYearMonth('2024-05-15T12:00:00Z')).toBe('May 2024')
  })
})

describe('formatDate', () => {
  it('renders an ISO timestamp as day + short month + year', () => {
    expect(formatDate('2024-05-15T12:00:00Z')).toBe('15 May 2024')
  })
})
