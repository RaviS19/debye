import { describe, expect, it } from 'vitest'
import { sci } from './constants'

describe('sci', () => {
  it('keeps zeros before the decimal point', () => {
    expect(sci(10)).toBe('10')
    expect(sci(20)).toBe('20')
    expect(sci(100)).toBe('100')
    expect(sci(1000)).toBe('1000')
    expect(sci(10, 2)).toBe('10')
  })
  it('drops trailing zeros after the point', () => {
    expect(sci(2.5)).toBe('2.5')
    expect(sci(0.0123)).toBe('0.0123')
    expect(sci(-40)).toBe('-40')
  })
  it('uses ×10ⁿ outside 0.01–9999', () => {
    expect(sci(1e19)).toBe('1.00×10¹⁹')
    expect(sci(3.2e-5)).toBe('3.20×10⁻⁵')
  })
})
