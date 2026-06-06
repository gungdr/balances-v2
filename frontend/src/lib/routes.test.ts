import { describe, it, expect } from 'vitest'

import { routes } from '@/lib/routes'

// The route builders are the link-safety convention (ADR-0025): these assert
// each id-builder nests its detail under the matching list path, so a typo in
// a builder is caught here rather than as a runtime 404.

describe('routes builders', () => {
  it('nests each subtype detail under its list path', () => {
    expect(routes.bankAccount('a1')).toBe(`${routes.bankAccounts}/a1`)
    expect(routes.property('p1')).toBe(`${routes.properties}/p1`)
    expect(routes.vehicle('v1')).toBe(`${routes.vehicles}/v1`)
    expect(routes.receivable('r1')).toBe(`${routes.receivables}/r1`)
    expect(routes.stock('s1')).toBe(`${routes.stocks}/s1`)
    expect(routes.mutualFund('m1')).toBe(`${routes.mutualFunds}/m1`)
    expect(routes.bond('b1')).toBe(`${routes.bonds}/b1`)
    expect(routes.timeDeposit('t1')).toBe(`${routes.timeDeposits}/t1`)
    expect(routes.goldItem('g1')).toBe(`${routes.gold}/g1`)
  })

  it('builds the liability detail under its subtype segment', () => {
    expect(routes.liability('personal', 'l1')).toBe('/liabilities/personal/l1')
    expect(routes.liability('institutional', 'l2')).toBe(
      '/liabilities/institutional/l2',
    )
  })

  it('exposes the static group/list paths', () => {
    expect(routes.dashboard).toBe('/')
    expect(routes.assets).toBe('/assets')
    expect(routes.investments).toBe('/investments')
    expect(routes.income).toBe('/income')
    expect(routes.settings).toBe('/settings')
  })
})
