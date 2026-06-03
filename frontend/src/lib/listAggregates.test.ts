import { describe, it, expect } from 'vitest'
import { aggregateListPositions, type Position } from '@/lib/listAggregates'

const pos = (overrides: Partial<Position> & { id: string }): Position => ({
  currency: 'IDR',
  status: 'active',
  latestValue: 0,
  cost: 0,
  snapshots: [],
  costSeries: [],
  ...overrides,
})

describe('aggregateListPositions — byCurrency totals', () => {
  it('returns empty totals on empty input', () => {
    const r = aggregateListPositions([])
    expect(r.byCurrency).toEqual([])
    expect(r.timeSeriesByCurrency.size).toBe(0)
    expect(r.count).toBe(0)
  })

  it('sums value + cost per currency for active positions', () => {
    const r = aggregateListPositions([
      pos({ id: 'a', currency: 'IDR', latestValue: 1000, cost: 800 }),
      pos({ id: 'b', currency: 'IDR', latestValue: 500, cost: 600 }),
      pos({ id: 'c', currency: 'USD', latestValue: 100, cost: 90 }),
    ])
    expect(r.byCurrency).toEqual([
      { currency: 'IDR', value: 1500, cost: 1400, pl: 100 },
      { currency: 'USD', value: 100, cost: 90, pl: 10 },
    ])
    expect(r.count).toBe(3)
  })

  it('excludes terminated positions from both totals + count', () => {
    const r = aggregateListPositions([
      pos({ id: 'a', currency: 'IDR', latestValue: 1000, cost: 800 }),
      pos({
        id: 'b',
        currency: 'IDR',
        status: 'sold',
        latestValue: 9999,
        cost: 9999,
      }),
    ])
    expect(r.byCurrency).toEqual([
      { currency: 'IDR', value: 1000, cost: 800, pl: 200 },
    ])
    expect(r.count).toBe(1)
  })

  it('counts cost basis even when a position has no value yet', () => {
    // A brand-new bond with face_value set but no snapshot still
    // contributes its cost to the headline (you've already committed
    // the money), but does not contribute to the value column.
    const r = aggregateListPositions([
      pos({ id: 'a', currency: 'IDR', latestValue: null, cost: 500 }),
    ])
    expect(r.byCurrency).toEqual([
      { currency: 'IDR', value: 0, cost: 500, pl: -500 },
    ])
    expect(r.count).toBe(0)
  })

  it('orders byCurrency by value desc, then currency code', () => {
    const r = aggregateListPositions([
      pos({ id: 'a', currency: 'USD', latestValue: 100, cost: 0 }),
      pos({ id: 'b', currency: 'IDR', latestValue: 100, cost: 0 }),
    ])
    expect(r.byCurrency.map((c) => c.currency)).toEqual(['IDR', 'USD'])
  })
})

describe('aggregateListPositions — time series', () => {
  it('emits a single-currency series with month-aligned sums', () => {
    const r = aggregateListPositions([
      pos({
        id: 'a',
        latestValue: 200,
        cost: 100,
        snapshots: [
          { year_month: '2026-01', amount: '120' },
          { year_month: '2026-02', amount: '200' },
        ],
        costSeries: [
          { year_month: '2026-01', cost: 100 },
          { year_month: '2026-02', cost: 100 },
        ],
      }),
      pos({
        id: 'b',
        latestValue: 60,
        cost: 50,
        snapshots: [
          { year_month: '2026-02', amount: '60' },
        ],
        costSeries: [
          { year_month: '2026-02', cost: 50 },
        ],
      }),
    ])
    const idr = r.timeSeriesByCurrency.get('IDR')
    expect(idr).toEqual([
      // Jan: only A has a snapshot → 120 / 100. B not yet on the chart.
      { year_month: '2026-01', value: 120, cost: 100 },
      // Feb: A=200 + B=60 = 260; cost = 100 + 50 = 150.
      { year_month: '2026-02', value: 260, cost: 150 },
    ])
  })

  it('carry-forwards the previous value when no current-month snapshot', () => {
    const r = aggregateListPositions([
      pos({
        id: 'a',
        latestValue: 100,
        cost: 100,
        snapshots: [
          { year_month: '2026-01', amount: '100' },
        ],
        costSeries: [{ year_month: '2026-01', cost: 100 }],
      }),
      pos({
        id: 'b',
        latestValue: 50,
        cost: 30,
        snapshots: [
          { year_month: '2026-01', amount: '40' },
          { year_month: '2026-02', amount: '50' },
        ],
        costSeries: [
          { year_month: '2026-01', cost: 30 },
          { year_month: '2026-02', cost: 30 },
        ],
      }),
    ])
    const idr = r.timeSeriesByCurrency.get('IDR')!
    // Feb: A carries its Jan 100; B has Feb 50. Total = 150.
    expect(idr[1]).toEqual({ year_month: '2026-02', value: 150, cost: 130 })
  })

  it('separates currencies into independent series maps', () => {
    const r = aggregateListPositions([
      pos({
        id: 'a',
        currency: 'IDR',
        latestValue: 100,
        cost: 100,
        snapshots: [{ year_month: '2026-01', amount: '100' }],
        costSeries: [{ year_month: '2026-01', cost: 100 }],
      }),
      pos({
        id: 'b',
        currency: 'USD',
        latestValue: 50,
        cost: 40,
        snapshots: [{ year_month: '2026-01', amount: '50' }],
        costSeries: [{ year_month: '2026-01', cost: 40 }],
      }),
    ])
    expect(r.timeSeriesByCurrency.get('IDR')).toEqual([
      { year_month: '2026-01', value: 100, cost: 100 },
    ])
    expect(r.timeSeriesByCurrency.get('USD')).toEqual([
      { year_month: '2026-01', value: 50, cost: 40 },
    ])
  })

  it('accepts API year_month formatted as YYYY-MM-DDTHH', () => {
    const r = aggregateListPositions([
      pos({
        id: 'a',
        latestValue: 100,
        cost: 100,
        snapshots: [
          { year_month: '2026-01-01T00:00:00Z', amount: '100' },
        ],
        costSeries: [{ year_month: '2026-01-01T00:00:00Z', cost: 100 }],
      }),
    ])
    expect(r.timeSeriesByCurrency.get('IDR')).toEqual([
      { year_month: '2026-01', value: 100, cost: 100 },
    ])
  })

  it('omits currencies whose only positions have no snapshots from the series map', () => {
    const r = aggregateListPositions([
      pos({ id: 'a', currency: 'IDR', latestValue: null, cost: 500 }),
    ])
    // byCurrency still records the cost; series map skips empty.
    expect(r.byCurrency).toHaveLength(1)
    expect(r.timeSeriesByCurrency.has('IDR')).toBe(false)
  })
})
