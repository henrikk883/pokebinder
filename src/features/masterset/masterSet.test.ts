import { describe, expect, it } from 'vitest'
import type { CardDetail, Catalog, SetSummary } from '../../lib/tcgdex'
import { createTestContext } from '../../test/modelContext'
import { countProgress } from '../binder/binderModel'
import {
  buildMasterSet,
  createMasterSetBinder,
  isSecretRare,
  pagesNeeded,
  promoSetIdOf,
  secretRareGroups,
  type MasterSetOptions,
  type MasterSetSource,
} from './masterSet'

const card = (localId: string, rarity: string | undefined, variants: string[], setId = 'sv08.5'): CardDetail => ({
  id: `${setId}-${localId}`,
  localId,
  name: `Karte ${localId}`,
  variants,
  ...(rarity === undefined ? {} : { rarity }),
})

/** A miniature "Prismatische Entwicklungen": 5 official cards, 4 secret rares. */
const cards: CardDetail[] = [
  card('001', 'Häufig', ['normal', 'reverse', 'masterball', 'pokeball']),
  card('002', 'Ungewöhnlich', ['normal', 'reverse', 'pokeball']),
  card('003', 'Selten', ['normal', 'holo', 'reverse']),
  card('004', 'Doppelselten', ['holo']),
  card('005', 'Häufig', ['normal']),
  card('006', 'Ultra Selten', ['holo']),
  card('007', 'Selten, besondere Illustration', ['holo']),
  card('008', 'Selten, besondere Illustration', ['holo']),
  card('009', 'Hyperselten', ['holo']),
]
const promos: CardDetail[] = [
  card('001', 'Promo', ['holo'], 'svp'),
  card('002', 'Promo', ['normal', 'holo'], 'svp'),
]
const source: MasterSetSource = { cards, officialCount: 5, promos, lang: 'de' }

const plain: MasterSetOptions = { withVariants: false, excludedSecretRarities: [], withPromos: false }

const ids = (refs: { cardId: string; variant: string }[]) => refs.map((ref) => `${ref.cardId.split('-')[1]}:${ref.variant}`)

describe('isSecretRare', () => {
  it('means a number above the official size of the set', () => {
    expect(isSecretRare({ localId: '165' }, 165)).toBe(false)
    expect(isSecretRare({ localId: '166' }, 165)).toBe(true)
    expect(isSecretRare({ localId: '001' }, 165)).toBe(false)
  })

  it('also means numbers of their own kind, like the trainer gallery', () => {
    expect(isSecretRare({ localId: 'TG01' }, 189)).toBe(true)
    expect(isSecretRare({ localId: 'SV001' }, 72)).toBe(true)
  })
})

describe('secretRareGroups', () => {
  it('counts the secret rares by rarity, in set order', () => {
    expect(secretRareGroups(cards, 5)).toEqual([
      { rarity: 'Ultra Selten', count: 1 },
      { rarity: 'Selten, besondere Illustration', count: 2 },
      { rarity: 'Hyperselten', count: 1 },
    ])
  })

  it('is empty for a set without secret rares, and groups cards without rarity', () => {
    expect(secretRareGroups(cards.slice(0, 5), 5)).toEqual([])
    expect(secretRareGroups([card('010', undefined, ['holo'])], 5)).toEqual([{ rarity: '', count: 1 }])
  })
})

describe('buildMasterSet', () => {
  it('without holo variants: every card of the set once, in number order', () => {
    const refs = buildMasterSet(source, plain)

    // the number of cards matches what TCGdex lists for the set
    expect(refs).toHaveLength(cards.length)
    expect(ids(refs)).toEqual([
      '001:normal',
      '002:normal',
      '003:normal',
      '004:holo',
      '005:normal',
      '006:holo',
      '007:holo',
      '008:holo',
      '009:holo',
    ])
    expect(refs[0]).toEqual({ cardId: 'sv08.5-001', lang: 'de', variant: 'normal' })
  })

  it('with holo variants: every further finish right behind its card', () => {
    const refs = buildMasterSet(source, { ...plain, withVariants: true })

    expect(ids(refs)).toEqual([
      '001:normal',
      '001:reverse',
      '001:masterball',
      '001:pokeball',
      '002:normal',
      '002:reverse',
      '002:pokeball',
      '003:normal',
      '003:holo',
      '003:reverse',
      '004:holo',
      '005:normal',
      '006:holo',
      '007:holo',
      '008:holo',
      '009:holo',
    ])
    // one pocket per finish TCGdex knows for the set
    expect(refs).toHaveLength(cards.reduce((sum, entry) => sum + entry.variants.length, 0))
  })

  it('leaves out the secret rares of the rarities that were deselected', () => {
    const refs = buildMasterSet(source, {
      ...plain,
      excludedSecretRarities: ['Selten, besondere Illustration', 'Hyperselten'],
    })

    expect(ids(refs)).toEqual(['001:normal', '002:normal', '003:normal', '004:holo', '005:normal', '006:holo'])
  })

  it('never drops a regular card because of its rarity', () => {
    const refs = buildMasterSet(source, { ...plain, excludedSecretRarities: ['Häufig', 'Doppelselten'] })

    expect(refs).toHaveLength(cards.length)
  })

  it('puts the promos at the end, each once', () => {
    const refs = buildMasterSet(source, { ...plain, withVariants: true, withPromos: true })

    expect(refs.slice(-2)).toEqual([
      { cardId: 'svp-001', lang: 'de', variant: 'holo' },
      { cardId: 'svp-002', lang: 'de', variant: 'normal' },
    ])
    expect(refs).toHaveLength(16 + 2)
  })

  it('ignores the promos unless they are wanted', () => {
    expect(buildMasterSet(source, plain).some((ref) => ref.cardId.startsWith('svp-'))).toBe(false)
  })
})

describe('createMasterSetBinder', () => {
  const input = {
    name: 'Prismatische Entwicklungen',
    layout: '2x2' as const,
    defaultOpeningSide: 'mixed' as const,
    setId: 'sv08.5',
    options: { ...plain, withVariants: true },
  }

  it('creates as many pages as the cards need, in order, all still missing', () => {
    const refs = buildMasterSet(source, input.options)

    const binder = createMasterSetBinder(input, refs, createTestContext())

    expect(binder.pages).toHaveLength(4) // 16 cards in pockets of four
    expect(binder.pages.map((page) => page.index)).toEqual([0, 1, 2, 3])
    expect(binder.pages.flatMap((page) => page.slots.map((slot) => slot.cardRef))).toEqual(refs)
    expect(binder.pages.every((page) => page.slots.every((slot) => slot.owned === false))).toBe(true)
    expect(countProgress(binder)).toEqual({ total: 16, owned: 0, missing: 16 })
  })

  it('remembers what it was made from', () => {
    const binder = createMasterSetBinder(input, buildMasterSet(source, input.options), createTestContext())

    expect(binder).toMatchObject({
      name: 'Prismatische Entwicklungen',
      mode: 'masterSet',
      setId: 'sv08.5',
      layout: '2x2',
      defaultOpeningSide: 'mixed',
      withReverseHolo: true,
      withSecretRares: true,
      withPromos: false,
      cover: { title: 'Prismatische Entwicklungen' },
    })
    expect(binder.pages.every((page) => page.openingSide === 'mixed')).toBe(true)
  })

  it('leaves the pockets after the last card empty', () => {
    const refs = buildMasterSet(source, plain) // 9 cards

    const binder = createMasterSetBinder({ ...input, layout: '3x3', options: plain }, refs.slice(0, 7), createTestContext())

    expect(binder.pages).toHaveLength(1)
    expect(binder.pages[0]?.slots.map((slot) => slot.cardRef !== undefined)).toEqual([
      true, true, true, true, true, true, true, false, false,
    ])
    expect(binder.withReverseHolo).toBe(false)
  })

  it('notes when secret rares were left out, and gives an empty set one page', () => {
    const options = { ...plain, excludedSecretRarities: ['Hyperselten'] }

    const binder = createMasterSetBinder({ ...input, options }, [], createTestContext())

    expect(binder.withSecretRares).toBe(false)
    expect(binder.pages).toHaveLength(1)
  })
})

describe('pagesNeeded', () => {
  it('rounds up to whole pages and never goes below one', () => {
    expect(pagesNeeded(207, '3x3')).toBe(23)
    expect(pagesNeeded(9, '3x3')).toBe(1)
    expect(pagesNeeded(10, '3x3')).toBe(2)
    expect(pagesNeeded(0, '4x4')).toBe(1)
  })
})

describe('promoSetIdOf', () => {
  const set = (id: string, seriesId: string): SetSummary => ({
    id,
    name: id,
    seriesId,
    cardCount: { total: 1, official: 1 },
  })
  const sets = [set('svp', 'sv'), set('sv03.5', 'sv'), set('col1', 'col')]
  const catalog: Catalog = { series: [], setsById: new Map(sets.map((entry) => [entry.id, entry])) }

  it('finds the promo set of the series a set belongs to', () => {
    expect(promoSetIdOf(catalog, 'sv03.5')).toBe('svp')
  })

  it('has none for a series without promo set, for the promo set itself and for unknown sets', () => {
    expect(promoSetIdOf(catalog, 'col1')).toBeUndefined()
    expect(promoSetIdOf(catalog, 'svp')).toBeUndefined()
    expect(promoSetIdOf(catalog, 'nope')).toBeUndefined()
  })
})
