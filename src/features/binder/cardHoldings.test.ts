import { describe, expect, it } from 'vitest'
import type { Binder, CardLang, Slot } from '../../types/binder'
import { holdingsOf } from './cardHoldings'

type Pocket = [cardId: string, owned: boolean, count?: number, lang?: CardLang] | null

function binder(id: string, pages: Pocket[][]): Binder {
  return {
    id,
    name: `Binder ${id}`,
    mode: 'empty',
    withReverseHolo: false,
    withSecretRares: false,
    withPromos: false,
    layout: '2x2',
    lang: 'de',
    defaultOpeningSide: 'left',
    cover: { title: '' },
    pages: pages.map((pockets, index) => ({
      id: `${id}-${index}`,
      index,
      openingSide: 'left',
      images: [],
      slots: pockets.map((pocket, slotIndex): Slot => {
        if (!pocket) return { index: slotIndex, owned: false }
        const [cardId, owned, count, lang = 'de'] = pocket
        return { index: slotIndex, cardRef: { cardId, lang, variant: 'normal' }, owned, ...(count ? { count } : {}) }
      }),
    })),
    createdAt: '2026-10-12T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  }
}

describe('holdingsOf', () => {
  const binders = [
    binder('a', [
      [['glurak', true, 2], null, ['pikachu', true]],
      [['glurak', false], ['glurak', true]],
    ]),
    binder('b', [[['pikachu', false]]]),
    binder('c', [[['glurak', true, undefined, 'en'], ['glurak', true]]]),
  ]

  it('adds up the copies that are there, over all binders', () => {
    expect(holdingsOf(binders, 'glurak').copies).toBe(5)
    expect(holdingsOf(binders, 'pikachu').copies).toBe(1)
  })

  it('names per binder the copies, the pockets still waiting and the pages', () => {
    expect(holdingsOf(binders, 'glurak').places[0]).toEqual({
      binderId: 'a',
      binderName: 'Binder a',
      lang: 'de',
      copies: 3,
      missing: 1,
      pages: [1, 2],
    })
  })

  it('lists a binder in which the card is only missing', () => {
    expect(holdingsOf(binders, 'pikachu').places.map((place) => [place.binderId, place.copies, place.missing])).toEqual([
      ['a', 1, 0],
      ['b', 0, 1],
    ])
  })

  it('tells the languages of a card apart within a binder', () => {
    expect(holdingsOf(binders, 'glurak').places.slice(1).map((place) => [place.binderId, place.lang, place.copies])).toEqual([
      ['c', 'en', 1],
      ['c', 'de', 1],
    ])
  })

  it('knows of nothing for a card that lies nowhere', () => {
    expect(holdingsOf(binders, 'mew')).toEqual({ copies: 0, places: [] })
  })
})
