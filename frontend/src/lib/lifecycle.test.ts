import { describe, it, expect } from 'vitest'
import {
  STATUS_OPTIONS,
  statusLabel,
  isActiveStatus,
  type LifecycleGroup,
} from '@/lib/lifecycle'

const groups: LifecycleGroup[] = [
  'assets',
  'liabilities',
  'receivables',
  'investments',
]

describe('STATUS_OPTIONS', () => {
  it('leads every group with the active option', () => {
    for (const group of groups) {
      expect(STATUS_OPTIONS[group][0]).toEqual({ value: 'active', label: 'Active' })
    }
  })
})

describe('statusLabel', () => {
  it('resolves a known status to its human label', () => {
    expect(statusLabel('liabilities', 'paid_off')).toBe('Paid off')
    expect(statusLabel('investments', 'matured')).toBe('Matured')
    expect(statusLabel('assets', 'disposed')).toBe('Disposed')
  })

  it('falls back to the raw value for an unknown status', () => {
    expect(statusLabel('receivables', 'sold')).toBe('sold')
    expect(statusLabel('assets', 'mystery')).toBe('mystery')
  })
})

describe('isActiveStatus', () => {
  it('is true only for "active"', () => {
    expect(isActiveStatus('active')).toBe(true)
    expect(isActiveStatus('closed')).toBe(false)
    expect(isActiveStatus('matured')).toBe(false)
    expect(isActiveStatus('')).toBe(false)
  })
})
