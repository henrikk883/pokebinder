import { beforeEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../../test/modelContext'
import type { Binder, CardLang } from '../../types/binder'
import { createBinder, setCard, type ModelContext } from './binderModel'
import { progressBySet, type SetLookup } from './setProgress'

let ctx: ModelContext
let binder: Binder

const NAMES: Record<string, string> = { 'sv03.5': '151', swsh9: 'Strahlende Sterne', SV2a: 'ポケモンカード151' }

/** Set ids are what stands before the last dash; sets that are not listed are not known. */
const setOf: SetLookup = (cardId) => {
  const id = cardId.slice(0, cardId.lastIndexOf('-'))
  const name = NAMES[id]
  return name === undefined ? undefined : { id, name }
}

function place(source: Binder, slotIndex: number, cardId: string, owned: boolean, lang: CardLang = 'de'): Binder {
  const pageId = source.pages[0]?.id ?? ''
  return setCard(source, { pageId, slotIndex }, { cardId, lang, variant: 'normal' }, owned, ctx)
}

beforeEach(() => {
  ctx = createTestContext()
  binder = createBinder({ name: 'Gemischt' }, ctx)
})

describe('progressBySet', () => {
  it('counts owned and missing cards for each set, in the order the sets appear', () => {
    let cards = place(binder, 0, 'swsh9-018', true)
    cards = place(cards, 1, 'sv03.5-006', true)
    cards = place(cards, 2, 'sv03.5-025', false)
    cards = place(cards, 4, 'swsh9-046', false)
    cards = place(cards, 5, 'sv03.5-001', false)

    expect(progressBySet(cards, setOf)).toEqual([
      { key: 'de:swsh9', lang: 'de', setId: 'swsh9', name: 'Strahlende Sterne', total: 2, owned: 1, missing: 1 },
      { key: 'de:sv03.5', lang: 'de', setId: 'sv03.5', name: '151', total: 3, owned: 1, missing: 2 },
    ])
  })

  it('counts the same set apart for each language', () => {
    let cards = place(binder, 0, 'sv03.5-006', true, 'de')
    cards = place(cards, 1, 'sv03.5-006', false, 'en')
    cards = place(cards, 2, 'SV2a-006', true, 'ja')

    expect(progressBySet(cards, setOf).map((row) => [row.key, row.owned, row.total])).toEqual([
      ['de:sv03.5', 1, 1],
      ['en:sv03.5', 0, 1],
      ['ja:SV2a', 1, 1],
    ])
  })

  it('puts cards whose set is not known last', () => {
    let cards = place(binder, 0, 'mystery-7', true)
    cards = place(cards, 1, 'sv03.5-006', false)
    cards = place(cards, 2, 'other-1', false)

    expect(progressBySet(cards, setOf).map((row) => [row.setId, row.name, row.total, row.owned])).toEqual([
      ['sv03.5', '151', 1, 0],
      ['', '', 2, 1],
    ])
  })

  it('counts a card that lies in two pockets twice, and nothing for an empty binder', () => {
    let cards = place(binder, 0, 'sv03.5-006', true)
    cards = place(cards, 8, 'sv03.5-006', false)

    expect(progressBySet(cards, setOf)).toMatchObject([{ total: 2, owned: 1, missing: 1 }])
    expect(progressBySet(binder, setOf)).toEqual([])
  })
})
