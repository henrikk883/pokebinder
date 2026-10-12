import { describe, expect, it } from 'vitest'
import { colourDistance, similarColours, sortByColour, SIGNATURE_LENGTH, type ColourIndex } from './similarColours'

/** An index of cards given by how much of which colour bin their picture has. */
function indexOf(cards: Record<string, Record<number, number>>, rare = Object.keys(cards).length): ColourIndex {
  const ids = Object.keys(cards)
  const signatures = new Uint8Array(ids.length * SIGNATURE_LENGTH)
  ids.forEach((id, position) => {
    for (const [bin, amount] of Object.entries(cards[id] ?? {})) {
      signatures[position * SIGNATURE_LENGTH + Number(bin)] = amount
    }
  })
  return { ids, rare, signatures }
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

  it('offers only the cards of the high rarities, whatever card is asked about', () => {
    const some = indexOf({ rareGreen: { 16: 255 }, rareOrange: { 4: 200, 16: 55 }, commonOrange: { 4: 255 }, common: { 4: 250 } }, 2)
    expect(similarColours(some, 'commonOrange', 5)).toEqual(['rareOrange', 'rareGreen'])
    expect(similarColours(some, 'rareOrange', 5)).toEqual(['rareGreen'])
  })

  it('has no answer for a card whose colours are not known', () => {
    expect(similarColours(index, 'sv2a-001', 3)).toBeUndefined()
  })
})

describe('sortByColour', () => {
  // bins: four per hue, twelve hues from red on; the greys from 48 (black) to 51 (white)
  const index = indexOf({
    blue: { 32: 255 },
    white: { 51: 255 },
    orange: { 4: 255 },
    red: { 0: 255 },
    black: { 48: 255 },
    green: { 16: 200, 51: 55 },
    purpleRed: { 44: 255 },
    yellowGreen: { 8: 128, 16: 127 },
  })

  it('goes round the colour wheel and puts the grey ones last, dark before light', () => {
    expect(sortByColour(index, index.ids)).toEqual(['red', 'orange', 'yellowGreen', 'green', 'blue', 'purpleRed', 'black', 'white'])
  })

  it('keeps the reds on both sides of the wheel together', () => {
    const reds = indexOf({ green: { 16: 255 }, justBelowRed: { 44: 60, 0: 195 }, red: { 0: 255 } })
    expect(sortByColour(reds, reds.ids)).toEqual(['justBelowRed', 'red', 'green'])
  })

  it('puts cards whose colours are not known at the end and leaves others out of it', () => {
    expect(sortByColour(index, ['white', 'unknown', 'blue', 'red'])).toEqual(['red', 'blue', 'white', 'unknown'])
  })

  it('counts a picture with little colour in it as grey', () => {
    const pale = indexOf({ nearlyGrey: { 0: 40, 50: 215 }, blue: { 32: 255 } })
    expect(sortByColour(pale, pale.ids)).toEqual(['blue', 'nearlyGrey'])
  })
})
