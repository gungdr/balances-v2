import { describe, it, expect } from 'vitest'
import { preferredName } from '@/lib/names'

describe('preferredName', () => {
  it('returns the nickname when set', () => {
    expect(preferredName({ nickname: 'Ali', display_name: 'Alice Anderson' })).toBe(
      'Ali',
    )
  })

  it('falls back to display_name when nickname is null', () => {
    expect(preferredName({ nickname: null, display_name: 'Alice' })).toBe('Alice')
  })

  it('falls back to display_name when nickname is undefined', () => {
    expect(preferredName({ display_name: 'Alice' })).toBe('Alice')
  })

  it('treats blank/whitespace nickname as unset', () => {
    expect(preferredName({ nickname: '', display_name: 'Alice' })).toBe('Alice')
    expect(preferredName({ nickname: '   ', display_name: 'Alice' })).toBe('Alice')
  })

  it('trims a set nickname', () => {
    expect(preferredName({ nickname: '  Ali  ', display_name: 'Alice' })).toBe('Ali')
  })
})
