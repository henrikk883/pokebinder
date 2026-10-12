import { describe, expect, it } from 'vitest'
import { colourDistance, similarColours, SIGNATURE_LENGTH, type ColourIndex } from './similarColours'

/** An index of cards given by how much of which colour bin their picture has. */
function indexOf(cards: Record<string, Record<number, number>>): ColourIndex {
  const ids = Object.keys(cards)
  const signatures = new Uint8Array(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, position) => {
    for (const [bin, amount] of Object.entries(cards[id] ?? {})) {
      signatures[position * SIGNATURE_LENGTH + Number(bin)] = amount
    }
  })
  return { ids, signatures }
}

describe('colourDistance', () => {
  it('is 0 for the same colours and 1 for none in common', () => {
    const index = indexOf({ a: { 0: 200, 5: 55 }, b: { 0: 200, 5: 55 }, c: { 20: 255 } })
    expect(colourDistance(index.signatures, 0, 1)).toBe(0)
    expect(colourDistance(index.signatures, 0, 2)).toBe(1)
  })

  it('grows as less of the colours is shared', () => {
    const index = indexOf({ a: { 0: 255 }, near: { 0: 200, 9: 55 }, far: { 0: 50, 9: 205 } })
    const near = colourDistance(index.signatures, 0, 1)
    const far = colourDistance(index.signatures, 0, 2)
    expect(near).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(near)
    expect(far).toBeLessThan(1)
  })

  it('is the same in both directions', () => {
    const index = indexOf({ a: { 0: 255 }, b: { 0: 100, 9: 155 } })
    expect(colourDistance(index.signatures, 0, 1)).toBe(colourDistance(index.signatures, 1, 0))
  })

  it('takes a picture nothing is known of as far from everything', () => {
    const index = indexOf({ a: { 0: 255 }, empty: {} })
    expect(colourDistance(index.signatures, 0, 1)).toBe(1)
  })
})

describe('similarColours', () => {
  const index = indexOf({
    orange: { 4: 255 },
    green: { 16: 255 },
    orangeToo: { 4: 230, 16: 25 },
    mixed: { 4: 120, 16: 135 },
    blue: { 30: 255 },
  })

  it('lists the nearest cards first and leaves the card itself out', () => {
    expect(similarColours(index, 'orange', 3)).toEqual(['orangeToo', 'mixed', 'green'])
  })

  it('gives no more than asked for, and no more than there are', () => {
    expect(similarColours(index, 'orange', 1)).toEqual(['orangeToo'])
    expect(similarColours(index, 'orange', 10)).toHaveLength(4)
  })

  it('keeps equally near cards in the order of the index', () => {
    expect(similarColours(index, 'blue', 4)).toEqual(['orange', 'green', 'orangeToo', 'mixed'])
  })

  it('has no answer for a card whose colours are not known', () => {
    expect(similarColours(index, 'sv2a-001', 3)).toBeUndefined()
  })
})
