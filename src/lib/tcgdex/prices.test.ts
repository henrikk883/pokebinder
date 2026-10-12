import { describe, expect, it } from 'vitest'
import { cardmarketPrice, mapWithConcurrency, type RawCardmarket, type RawPricedCard } from './prices'

const print = (type: string, foil: string | null, market: RawCardmarket | null, stamp: string[] | null = null) => ({
  type,
  foil,
  stamp,
  size: 'standard',
  pricing: { cardmarket: market },
})

/** Pikachu from "151": normal and reverse holo share one Cardmarket product. */
const shared: RawCardmarket = { unit: 'EUR', avg: 0.14, trend: 0.18, 'avg-holo': 0.56, 'trend-holo': 0.63 }
const pikachu: RawPricedCard = {
  pricing: { cardmarket: shared },
  variants_detailed: [
    print('normal', null, shared),
    print('reverse', null, shared),
    print('normal', null, { unit: 'EUR', avg: 77.98, trend: 71.02 }, ['pokemon-together']),
    print('reverse', 'cosmos', { unit: 'EUR', avg: null, trend: 0, 'avg-holo': 14.21, 'trend-holo': 18.04 }),
  ],
}

describe('cardmarketPrice', () => {
  it('takes the price trend of the normal card', () => {
    expect(cardmarketPrice(pikachu, 'normal')).toEqual({ amount: 0.18, currency: 'EUR' })
  })

  it('takes the holo figures for the reverse holo of the same product', () => {
    expect(cardmarketPrice(pikachu, 'reverse')).toEqual({ amount: 0.63, currency: 'EUR' })
  })

  it('does not mistake a stamped print for the regular card', () => {
    expect(cardmarketPrice(pikachu, 'normal')?.amount).not.toBe(71.02)
  })

  it('finds a special pattern, which is a product of its own', () => {
    const owei: RawPricedCard = {
      pricing: { cardmarket: { unit: 'EUR', trend: 0.02 } },
      variants_detailed: [
        print('normal', null, { unit: 'EUR', trend: 0.02, 'trend-holo': 0.16 }),
        print('reverse', null, { unit: 'EUR', trend: 0.02, 'trend-holo': 0.16 }),
        print('reverse', 'pokeball', { unit: 'EUR', avg: null, trend: 0.25, 'trend-holo': 0.34 }),
        print('reverse', 'masterball', { unit: 'EUR', avg: null, trend: 0, 'avg-holo': 1.96, 'trend-holo': 1.64 }),
      ],
    }

    expect(cardmarketPrice(owei, 'pokeball')?.amount).toBe(0.34)
    expect(cardmarketPrice(owei, 'masterball')?.amount).toBe(1.64)
    expect(cardmarketPrice(owei, 'reverse')?.amount).toBe(0.16)
    expect(cardmarketPrice(owei, 'normal')?.amount).toBe(0.02)
  })

  it('uses the plain figures for a card that only exists as holo', () => {
    const mew: RawPricedCard = {
      pricing: { cardmarket: { unit: 'EUR', avg: 7.58, trend: 7.22, 'avg-holo': null, 'trend-holo': 0 } },
      variants_detailed: [print('holo', null, { unit: 'EUR', avg: 7.58, trend: 7.22, 'trend-holo': 0 })],
    }

    expect(cardmarketPrice(mew, 'holo')).toEqual({ amount: 7.22, currency: 'EUR' })
  })

  it('falls back to the average where there is no trend', () => {
    const card: RawPricedCard = { variants_detailed: [print('normal', null, { avg: 1.5, trend: 0 })] }

    expect(cardmarketPrice(card, 'normal')).toEqual({ amount: 1.5, currency: 'EUR' })
  })

  it('falls back to the main price of the card when its prints carry other names', () => {
    // German card data names the prints in German
    const german: RawPricedCard = {
      pricing: { cardmarket: shared },
      variants_detailed: [print('Normal', null, shared), print('Reverse', null, shared)],
    }

    expect(cardmarketPrice(german, 'normal')?.amount).toBe(0.18)
    expect(cardmarketPrice(german, 'reverse')?.amount).toBe(0.63)
  })

  it('has no price where Cardmarket has no figures', () => {
    expect(cardmarketPrice({}, 'normal')).toBeUndefined()
    expect(cardmarketPrice({ pricing: { cardmarket: null } }, 'normal')).toBeUndefined()
    expect(cardmarketPrice({ pricing: { cardmarket: { trend: 0, avg: null } } }, 'normal')).toBeUndefined()
  })
})

describe('mapWithConcurrency', () => {
  it('keeps the order of the results and reports progress', async () => {
    const progress: string[] = []

    const results = await mapWithConcurrency(
      [30, 10, 20],
      2,
      async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms))
        return ms * 2
      },
      (done, total) => progress.push(`${done}/${total}`),
    )

    expect(results).toEqual([60, 20, 40])
    expect(progress).toEqual(['1/3', '2/3', '3/3'])
  })

  it('never runs more tasks at once than allowed', async () => {
    let running = 0
    let peak = 0

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      peak = Math.max(peak, ++running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running--
    })

    expect(peak).toBe(4)
  })

  it('copes with nothing to do', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([])
  })
})
