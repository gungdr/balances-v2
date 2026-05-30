import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { thisYearMonth, todayDate } from './dateLimits'

describe('dateLimits', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pin local time to 2026-05-30 09:15:00. Asserting against fixed strings
    // would be timezone-sensitive otherwise.
    vi.setSystemTime(new Date(2026, 4, 30, 9, 15, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('thisYearMonth returns YYYY-MM in local time', () => {
    expect(thisYearMonth()).toBe('2026-05')
  })

  it('todayDate returns YYYY-MM-DD in local time', () => {
    expect(todayDate()).toBe('2026-05-30')
  })

  it('zero-pads single-digit months and days', () => {
    vi.setSystemTime(new Date(2027, 0, 3, 12, 0, 0))
    expect(thisYearMonth()).toBe('2027-01')
    expect(todayDate()).toBe('2027-01-03')
  })
})
