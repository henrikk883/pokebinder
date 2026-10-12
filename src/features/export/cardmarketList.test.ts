import { describe, expect, it } from 'vitest'
import {
  cardmarketCardOf,
  cardmarketLine,
  cardmarketLines,
  versionAmong,
  type CardmarketCard,
} from './cardmarketList'

const mew = (version?: number): CardmarketCard => ({
  name: 'Mew ex',
  moves: ['Restart', 'Genome Hacking'],
  expansion: '151',
  ...(version === undefined ? {} : { version }),
})
const balloon: CardmarketCard = { name: 'Big Air Balloon', moves: [], expansion: '151' }

describe('cardmarketCardOf', () => {
  it('takes the name, then the abilities, then the attacks, and the set as expansion', () => {
    // Cardmarket's own example: "Mew EX Restart Genome Hacking"
    expect(
      cardmarketCardOf({
        name: 'Mew ex',
        abilities: [{ name: 'Restart' }],
        attacks: [{ name: 'Genome Hacking' }],
        set: { id: 'sv03.5', name: '151' },
      }),
    ).toEqual({ name: 'Mew ex', moves: ['Restart', 'Genome Hacking'], expansion: '151' })
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

describe('versionAmong', () => {
  const moves = ['Restart', 'Genome Hacking']
  // the three Mew ex of "151", in the order of their numbers
  const prints = [{ id: 'sv03.5-151', moves }, { id: 'sv03.5-193', moves }, { id: 'sv03.5-205', moves }]

  it('counts the prints of a card in the order of their numbers, as Cardmarket does', () => {
    // tried at Cardmarket: V.1 is 151/165, V.2 is 193/165, V.3 is 205/165
    expect(versionAmong('sv03.5-151', moves, prints)).toBe(1)
    expect(versionAmong('sv03.5-193', moves, prints)).toBe(2)
    expect(versionAmong('sv03.5-205', moves, prints)).toBe(3)
  })

  it('has no version for the only print of a card', () => {
    expect(versionAmong('sv03.5-151', moves, [{ id: 'sv03.5-151', moves }])).toBeUndefined()
    expect(versionAmong('sv03.5-151', moves, [])).toBeUndefined()
  })

  it('does not count another card of the same name', () => {
    const other = { id: 'set-010', moves: ['Thunder Shock'] }
    const pikachu = ['Quick Attack']

    expect(versionAmong('set-025', pikachu, [other, { id: 'set-025', moves: pikachu }])).toBeUndefined()
    expect(versionAmong('set-099', pikachu, [other, { id: 'set-025', moves: pikachu }, { id: 'set-099', moves: ['quick attack'] }])).toBe(2)
  })

  it('takes a print it knows nothing about for a print of the card', () => {
    expect(versionAmong('sv03.5-193', moves, [{ id: 'sv03.5-151' }, { id: 'sv03.5-193', moves }])).toBe(2)
  })
})

describe('cardmarketLines', () => {
  it('names expansion and version in brackets, the way Cardmarket takes them', () => {
    expect(cardmarketLine(mew(2), 1)).toBe('1x Mew ex Restart Genome Hacking (V.2) (151)')
    expect(cardmarketLine(mew(), 1)).toBe('1x Mew ex Restart Genome Hacking (151)')
    expect(cardmarketLine(balloon, 3)).toBe('3x Big Air Balloon (151)')
    // without a set there is nothing a version could refer to
    expect(cardmarketLine({ name: 'Mew ex', moves: ['Restart'], version: 2 }, 1)).toBe('1x Mew ex Restart')
  })

  it('keeps the prints of a card apart and adds up the same print', () => {
    expect(cardmarketLines([mew(1), balloon, mew(3), mew(1)])).toEqual([
      '2x Mew ex Restart Genome Hacking (V.1) (151)',
      '1x Big Air Balloon (151)',
      '1x Mew ex Restart Genome Hacking (V.3) (151)',
    ])
  })

  it('has no lines for no cards', () => {
    expect(cardmarketLines([])).toEqual([])
  })
})
