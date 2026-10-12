import { describe, expect, it } from 'vitest'
import { cardmarketCardOf, cardmarketLine, cardmarketLines, type CardmarketCard } from './cardmarketList'

const bulbasaur: CardmarketCard = { name: 'Bulbasaur', moves: ['Leech Seed'] }
const venusaur: CardmarketCard = { name: 'Venusaur ex', moves: ['Tranquil Flower', 'Dangerous Toxwhip'] }

describe('cardmarketCardOf', () => {
  it('takes the name, then the abilities, then the attacks, as Cardmarket wants them', () => {
    // Cardmarket's own example: "Mew EX Restart Genome Hacking"
    expect(
      cardmarketCardOf({ name: 'Mew ex', abilities: [{ name: 'Restart' }], attacks: [{ name: 'Genome Hacking' }] }),
    ).toEqual({ name: 'Mew ex', moves: ['Restart', 'Genome Hacking'] })
  })

  it('has just the name for trainers and energy', () => {
    expect(cardmarketCardOf({ name: " Erika's Invitation " })).toEqual({ name: "Erika's Invitation", moves: [] })
    expect(cardmarketCardOf({ name: 'Scoop Up Net', abilities: null, attacks: [] })).toEqual({ name: 'Scoop Up Net', moves: [] })
  })

  it('leaves out what has no name', () => {
    expect(cardmarketCardOf({})).toBeUndefined()
    expect(cardmarketCardOf({ name: '  ' })).toBeUndefined()
    expect(cardmarketCardOf({ name: 'Ditto', attacks: [{ name: null }, null, { name: 'Copy' }] })?.moves).toEqual(['Copy'])
  })
})

describe('cardmarketLines', () => {
  it('writes one card per line with its number in front', () => {
    expect(cardmarketLine(venusaur, 2)).toBe('2x Venusaur ex Tranquil Flower Dangerous Toxwhip')
    expect(cardmarketLines([bulbasaur, venusaur])).toEqual([
      '1x Bulbasaur Leech Seed',
      '1x Venusaur ex Tranquil Flower Dangerous Toxwhip',
    ])
  })

  it('adds up prints Cardmarket cannot tell apart, in the place of the first', () => {
    const sameAttacks: CardmarketCard = { name: 'bulbasaur', moves: ['Leech Seed'] }
    const otherBulbasaur: CardmarketCard = { name: 'Bulbasaur', moves: ['Vine Whip'] }

    expect(cardmarketLines([bulbasaur, venusaur, sameAttacks, otherBulbasaur])).toEqual([
      '2x Bulbasaur Leech Seed',
      '1x Venusaur ex Tranquil Flower Dangerous Toxwhip',
      '1x Bulbasaur Vine Whip',
    ])
  })

  it('has no lines for no cards', () => {
    expect(cardmarketLines([])).toEqual([])
  })
})
