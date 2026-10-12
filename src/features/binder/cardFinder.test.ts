import { describe, expect, it } from 'vitest'
import { addPage, createBinder, setCard } from './binderModel'
import { findCards, matchesCard, normalizeText, placedRefs, type FindEntry } from './cardFinder'

const ref = (cardId: string) => ({ cardId, lang: 'de', variant: 'normal' }) as const

describe('placedRefs', () => {
  it('lists the cards with page and pocket, in the order they lie in the binder', () => {
    let binder = addPage(createBinder({ name: 'Kanto', layout: '2x2' }))
    const [first, second] = binder.pages
    if (!first || !second) throw new Error('two pages expected')
    binder = setCard(binder, { pageId: second.id, slotIndex: 1 }, ref('sv03.5-025'))
    binder = setCard(binder, { pageId: first.id, slotIndex: 3 }, ref('sv03.5-001'))

    expect(placedRefs(binder).map((entry) => [entry.cardRef.cardId, entry.pageIndex, entry.slotIndex])).toEqual([
      ['sv03.5-001', 0, 3],
      ['sv03.5-025', 1, 1],
    ])
    expect(placedRefs(binder)[1]?.position).toEqual({ pageId: second.id, slotIndex: 1 })
    expect(placedRefs(createBinder({ name: 'Leer' }))).toEqual([])
  })
})

describe('matchesCard', () => {
  const pikachu = { name: 'Pikachu', localId: '025' }

  it('finds a card by a part of its name, whatever the case and the accents', () => {
    expect(matchesCard(pikachu, 'pika')).toBe(true)
    expect(matchesCard(pikachu, 'KACHU')).toBe(true)
    expect(matchesCard({ name: 'Pokémon-Fänger', localId: '187' }, 'pokemon')).toBe(true)
    expect(matchesCard(pikachu, 'raichu')).toBe(false)
    expect(normalizeText('  Flabébé ')).toBe('flabebe')
  })

  it('finds a card by its number, with or without zeros, alone or as printed', () => {
    expect(matchesCard(pikachu, '25')).toBe(true)
    expect(matchesCard(pikachu, '025')).toBe(true)
    expect(matchesCard(pikachu, '025/165')).toBe(true)
    expect(matchesCard(pikachu, '2')).toBe(false)
    expect(matchesCard({ name: 'Glurak', localId: 'TG03' }, 'tg03')).toBe(true)
  })

  it('finds nothing for nothing', () => {
    expect(matchesCard(pikachu, '')).toBe(false)
    expect(matchesCard(pikachu, '   ')).toBe(false)
  })
})

describe('findCards', () => {
  const entry = (name: string, localId: string, pageIndex: number): FindEntry => ({
    name,
    localId,
    pageIndex,
    slotIndex: 0,
    position: { pageId: `page-${pageIndex}`, slotIndex: 0 },
    cardRef: ref(`set-${localId}`),
  })
  const entries = [entry('Pikachu', '025', 2), entry('Raichu', '026', 2), entry('Pikachu', '173', 20)]

  it('gives every place a card lies in, in the order of the binder', () => {
    expect(findCards(entries, 'pikachu').map((found) => found.pageIndex)).toEqual([2, 20])
    expect(findCards(entries, '26').map((found) => found.name)).toEqual(['Raichu'])
    expect(findCards(entries, 'mew')).toEqual([])
  })

  it('stops at the limit', () => {
    expect(findCards(entries, 'chu', 2)).toHaveLength(2)
  })
})
