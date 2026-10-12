import { describe, expect, it } from 'vitest'
import type { CardSummary, SetSummary } from '../../lib/tcgdex'
import { createTestContext } from '../../test/modelContext'
import { binderFromCards, cardOfEntry, setsNamed } from './importList'

const set = (id: string, name: string): SetSummary => ({ id, name, seriesId: 'sv', cardCount: { total: 1, official: 1 } })
const card = (localId: string, name: string): CardSummary => ({ id: `sv03.5-${localId}`, localId, name })

describe('setsNamed', () => {
  const german = [set('sv03.5', '151'), set('me01', 'Mega-Entwicklung')]
  const english = [set('sv03.5', '151'), set('me01', 'Mega Evolution')]

  it('finds a set by its name in any of the languages, whatever the case', () => {
    expect(setsNamed('Mega-Entwicklung', [german, english])).toEqual(['me01'])
    expect(setsNamed('mega evolution', [german, english])).toEqual(['me01'])
    // the same set under the same name in two languages is one set
    expect(setsNamed('151', [german, english])).toEqual(['sv03.5'])
    expect(setsNamed('Fantasie', [german, english])).toEqual([])
  })
})

describe('cardOfEntry', () => {
  const cards = [card('150', 'Mewtu'), card('151', 'Mew ex'), card('193', 'Mew ex'), card('205', 'Mew ex')]
  const entry = (number: string, version?: number) => ({
    amount: 1,
    name: 'Mew ex',
    setCode: 'MEW',
    number,
    expansion: '151',
    ...(version === undefined ? {} : { version }),
  })

  it('finds the card by its number in the set', () => {
    expect(cardOfEntry(entry('193', 2), cards)).toEqual(card('193', 'Mew ex'))
    // numbers are written with and without leading zeros
    expect(cardOfEntry(entry('0150'), cards)).toEqual(card('150', 'Mewtu'))
    expect(cardOfEntry(entry('999'), cards)).toBe('unknownCard')
    expect(cardOfEntry({ amount: 1, name: 'Mew ex' }, cards)).toBe('unknownCard')
  })

  it('tells a product that is no card of the set by its version', () => {
    // Cardmarket lists a metal card as "Mew ex (MEW 205), Version 4": the set has three Mew ex
    expect(cardOfEntry(entry('205', 3), cards)).toEqual(card('205', 'Mew ex'))
    expect(cardOfEntry(entry('205', 4), cards)).toBe('special')
  })
})

describe('binderFromCards', () => {
  it('lays the cards out in the order of the list, as missing, on as many pages as they need', () => {
    const cards = Array.from({ length: 5 }, (_, index) => ({ cardId: `sv03.5-00${index + 1}`, variant: 'normal' as const }))

    const binder = binderFromCards({ name: 'Wünsche', layout: '2x2', lang: 'en' }, cards, createTestContext())

    expect(binder).toMatchObject({ name: 'Wünsche', layout: '2x2', lang: 'en', mode: 'empty' })
    expect(binder.pages).toHaveLength(2)
    expect(binder.pages.map((page) => page.index)).toEqual([0, 1])
    expect(binder.pages.flatMap((page) => page.slots.map((slot) => slot.cardRef?.cardId))).toEqual([
      'sv03.5-001',
      'sv03.5-002',
      'sv03.5-003',
      'sv03.5-004',
      'sv03.5-005',
      undefined,
      undefined,
      undefined,
    ])
    expect(binder.pages[0]?.slots[0]).toEqual({
      index: 0,
      cardRef: { cardId: 'sv03.5-001', lang: 'en', variant: 'normal' },
      owned: false,
    })
  })

  it('makes a binder with one empty page of nothing', () => {
    const binder = binderFromCards({ name: 'Leer', layout: '3x3', lang: 'de' }, [])

    expect(binder.pages).toHaveLength(1)
    expect(binder.pages[0]?.slots.every((slot) => slot.cardRef === undefined)).toBe(true)
  })
})
