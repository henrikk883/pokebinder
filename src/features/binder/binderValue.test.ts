import { describe, expect, it } from 'vitest'
import { summarizeValue } from './binderValue'

describe('summarizeValue', () => {
  it('adds up what is owned and what is still missing separately', () => {
    expect(
      summarizeValue([
        { owned: true, price: 12.5 },
        { owned: true, price: 0.63 },
        { owned: false, price: 7.22 },
        { owned: false, price: 0.02 },
      ]),
    ).toEqual({ owned: 13.13, missing: 7.24, unpriced: 0 })
  })

  it('counts cards without a price instead of guessing', () => {
    expect(
      summarizeValue([{ owned: true }, { owned: false }, { owned: false, price: 1 }]),
    ).toEqual({ owned: 0, missing: 1, unpriced: 2 })
  })

  it('is exact for many small amounts', () => {
    const cards = Array.from({ length: 300 }, (_, index) => ({ owned: index % 3 === 0, price: 0.1 }))

    expect(summarizeValue(cards)).toEqual({ owned: 10, missing: 20, unpriced: 0 })
  })

  it('is zero for an empty binder', () => {
    expect(summarizeValue([])).toEqual({ owned: 0, missing: 0, unpriced: 0 })
  })
})
