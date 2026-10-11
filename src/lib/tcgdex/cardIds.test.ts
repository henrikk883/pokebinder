import { describe, expect, it } from 'vitest'
import { compareLocalId, matchesNumber, setIdOfCard, sortByNumber } from './cardIds'

describe('setIdOfCard', () => {
  it.each([
    ['sv03.5-025', '025', 'sv03.5'],
    ['swsh3-136', '136', 'swsh3'],
    ['pl4-1', '1', 'pl4'],
    ['30th-c-001', '001', '30th-c'],
    ['swsh12.5gg-GG01', 'GG01', 'swsh12.5gg'],
    ['P-A-012', '012', 'P-A'],
  ])('reads the set of %s', (id, localId, setId) => {
    expect(setIdOfCard({ id, localId })).toBe(setId)
  })

  it('falls back to the last dash when the id does not end with the number', () => {
    expect(setIdOfCard({ id: 'base1-4', localId: '004' })).toBe('base1')
    expect(setIdOfCard({ id: 'odd', localId: '1' })).toBe('odd')
  })
})

describe('number order', () => {
  it('sorts by value instead of by text', () => {
    const cards = ['10', '2', '100', '1', '021'].map((localId) => ({ localId }))

    expect(sortByNumber(cards).map((card) => card.localId)).toEqual(['1', '2', '10', '021', '100'])
  })

  it('puts prefixed numbers after plain ones and keeps them in order', () => {
    const cards = ['TG02', '189', 'TG10', '001', 'TG01', 'SV001'].map((localId) => ({ localId }))

    expect(sortByNumber(cards).map((card) => card.localId)).toEqual([
      '001',
      '189',
      'SV001',
      'TG01',
      'TG02',
      'TG10',
    ])
  })

  it('does not change the list it is given', () => {
    const cards = [{ localId: '2' }, { localId: '1' }]

    sortByNumber(cards)

    expect(cards.map((card) => card.localId)).toEqual(['2', '1'])
    expect(compareLocalId('2', '2')).toBe(0)
  })
})

describe('matchesNumber', () => {
  it('ignores leading zeros and case', () => {
    expect(matchesNumber('025', '25')).toBe(true)
    expect(matchesNumber('25', '025')).toBe(true)
    expect(matchesNumber('TG01', 'tg01')).toBe(true)
    expect(matchesNumber('0', '000')).toBe(true)
  })

  it('does not match numbers that merely contain the input', () => {
    expect(matchesNumber('125', '25')).toBe(false)
    expect(matchesNumber('250', '25')).toBe(false)
    expect(matchesNumber('TG25', '25')).toBe(false)
  })
})
