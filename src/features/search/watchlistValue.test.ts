import { describe, expect, it } from 'vitest'
import { sumPrices } from './watchlistValue'

describe('sumPrices', () => {
  it('adds up what the cards cost', () => {
    expect(sumPrices([0.18, 5.09, 12.3])).toEqual({ total: 17.57, unpriced: 0 })
  })

  it('counts cards without a price and leaves them out of the sum', () => {
    expect(sumPrices([2.5, undefined, 1, undefined])).toEqual({ total: 3.5, unpriced: 2 })
    expect(sumPrices([undefined])).toEqual({ total: 0, unpriced: 1 })
  })

  it('does not drift over many small amounts', () => {
    // 0.1 + 0.2 is not 0.3 in floating point; in cents it is
    expect(sumPrices([0.1, 0.2]).total).toBe(0.3)
    expect(sumPrices(Array.from({ length: 1000 }, () => 0.01)).total).toBe(10)
  })

  it('is nothing for an empty list', () => {
    expect(sumPrices([])).toEqual({ total: 0, unpriced: 0 })
  })
})
