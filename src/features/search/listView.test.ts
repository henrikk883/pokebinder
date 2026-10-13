import { describe, expect, it } from 'vitest'
import type { CardSummary } from '../../lib/tcgdex'
import { matchesListSearch, sortListed, type ListedCard } from './listView'

const card = (id: string, name: string): CardSummary => ({ id, localId: id.slice(id.lastIndexOf('-') + 1), name })
const glurak: ListedCard = { card: card('sv03.5-006', 'Glurak-ex'), setName: '151' }
const pikachu: ListedCard = { card: card('sv03.5-025', 'Pikachu'), setName: '151' }
const evoli: ListedCard = { card: card('sv08.5-075', 'Evoli'), setName: 'Prismatische Entwicklungen' }
const arktos: ListedCard = { card: card('sv03.5-144', 'Arktos'), setName: '151' }

describe('matchesListSearch', () => {
  it('finds a card by a part of its name, whatever the case or the accents', () => {
    expect(matchesListSearch('glur', glurak.card.id, glurak)).toBe(true)
    expect(matchesListSearch('GLURAK', glurak.card.id, glurak)).toBe(true)
    expect(matchesListSearch('Pokemon', 'x-1', { card: card('x-1', 'Pokémon-Fänger') })).toBe(true)
    expect(matchesListSearch('pika', glurak.card.id, glurak)).toBe(false)
  })

  it('finds it by its number, its set or its id as well', () => {
    expect(matchesListSearch('006', glurak.card.id, glurak)).toBe(true)
    expect(matchesListSearch('prismatische', evoli.card.id, evoli)).toBe(true)
    expect(matchesListSearch('sv08.5', evoli.card.id, evoli)).toBe(true)
  })

  it('wants every word to be found, in any order', () => {
    expect(matchesListSearch('151 glurak', glurak.card.id, glurak)).toBe(true)
    expect(matchesListSearch('glurak prismatische', glurak.card.id, glurak)).toBe(false)
  })

  it('finds every card while nothing is typed, and an unknown card by its id only', () => {
    expect(matchesListSearch('  ', glurak.card.id, glurak)).toBe(true)
    expect(matchesListSearch('sv03', 'sv03.5-006', undefined)).toBe(true)
    expect(matchesListSearch('glurak', 'sv03.5-006', undefined)).toBe(false)
  })
})

describe('sortListed', () => {
  const entries = [pikachu, evoli, undefined, glurak, arktos]
  const same = (entry: ListedCard | undefined) => entry
  const names = (sorted: (ListedCard | undefined)[]) => sorted.map((entry) => entry?.card.name ?? '?')

  it('keeps the order of the list where that is asked for', () => {
    expect(sortListed(entries, 'added', same)).toEqual(entries)
    expect(sortListed(entries, 'colour', same)).toEqual(entries)
  })

  it('orders by name, with cards that are not known at the end', () => {
    expect(names(sortListed(entries, 'name', same))).toEqual(['Arktos', 'Evoli', 'Glurak-ex', 'Pikachu', '?'])
  })

  it('orders by set and then by number as printed on the cards', () => {
    expect(names(sortListed(entries, 'set', same))).toEqual(['Glurak-ex', 'Pikachu', 'Arktos', 'Evoli', '?'])
  })

  it('leaves the list given untouched', () => {
    const before = [...entries]
    sortListed(entries, 'name', same)
    expect(entries).toEqual(before)
  })
})
