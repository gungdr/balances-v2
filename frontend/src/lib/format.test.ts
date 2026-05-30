import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatYearMonth,
  formatDate,
  formatSignedPercent,
  roundToCurrency,
} from '@/lib/format'

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

describe('formatSignedPercent', () => {
  it('prefixes positive with "+" and 2dp', () => {
    expect(formatSignedPercent('3.5')).toBe('+3.50%')
  })
  it('prefixes negative with real minus "−" and 2dp', () => {
    expect(formatSignedPercent('-2')).toBe('−2.00%')
  })
  it('renders zero without a sign', () => {
    expect(formatSignedPercent('0')).toBe('0.00%')
  })
  it('returns the raw input when the value is not a number', () => {
    expect(formatSignedPercent('abc')).toBe('abc')
  })
})

describe('roundToCurrency', () => {
  it('rounds to 0 dp for no-decimal currencies (IDR)', () => {
    expect(roundToCurrency('19493588.6896', 'IDR')).toBe('19493589')
    expect(roundToCurrency('19493588.4', 'IDR')).toBe('19493588')
  })
  it('rounds to 0 dp for other no-decimal currencies (JPY/KRW/VND)', () => {
    for (const ccy of ['JPY', 'KRW', 'VND']) {
      expect(roundToCurrency('1234.567', ccy)).toBe('1235')
    }
  })
  it('rounds to 2 dp for ordinary currencies (USD)', () => {
    expect(roundToCurrency('19493588.6896', 'USD')).toBe('19493588.69')
    expect(roundToCurrency('100', 'USD')).toBe('100.00')
  })
  it('returns the raw input when the amount is not a number', () => {
    expect(roundToCurrency('not-a-number', 'IDR')).toBe('not-a-number')
  })
})
