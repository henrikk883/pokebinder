import { baseVariant, type CardDetail, type Catalog } from '../../lib/tcgdex'
import type { Binder, CardLang, CardRef, Layout, OpeningSide, Slot } from '../../types/binder'
import {
  createBinder,
  createPage,
  defaultContext,
  slotsPerPage,
  type ModelContext,
} from '../binder/binderModel'

/**
 * A secret rare carries a number above the official size of its set (166/165), or a
 * number of its own kind (TG01). Illustration rares, special illustration rares, hyper
 * rares and the like all fall under it; their rarity tells them apart.
 */
export function isSecretRare(card: Pick<CardDetail, 'localId'>, officialCount: number): boolean {
  if (!/^\d+$/.test(card.localId)) return true
  return Number(card.localId) > officialCount
}

export interface RarityGroup {
  /** Rarity as TCGdex names it; empty for cards without one. */
  rarity: string
  count: number
}

/** The secret rares of a set by rarity, in the order they appear in the set. */
export function secretRareGroups(cards: readonly CardDetail[], officialCount: number): RarityGroup[] {
  const groups = new Map<string, number>()
  for (const card of cards) {
    if (!isSecretRare(card, officialCount)) continue
    const rarity = card.rarity ?? ''
    groups.set(rarity, (groups.get(rarity) ?? 0) + 1)
  }
  return [...groups].map(([rarity, count]) => ({ rarity, count }))
}

export interface MasterSetOptions {
  /** A pocket of its own for every further finish: reverse holo and each special pattern. */
  withVariants: boolean
  /** Rarities of secret rares to leave out; empty means all secret rares are included. */
  excludedSecretRarities: readonly string[]
  withPromos: boolean
}

export interface MasterSetSource {
  cards: readonly CardDetail[]
  officialCount: number
  /** Cards of the series' promo set; used when promos are wanted. */
  promos: readonly CardDetail[]
  lang: CardLang
}

/**
 * The cards of a master set in binder order: the set by number, each card followed by
 * its further finishes if wanted, and the promos at the end.
 */
export function buildMasterSet(source: MasterSetSource, options: MasterSetOptions): CardRef[] {
  const { lang } = source
  const refs: CardRef[] = []

  for (const card of source.cards) {
    if (
      isSecretRare(card, source.officialCount) &&
      options.excludedSecretRarities.includes(card.rarity ?? '')
    ) {
      continue
    }
    const base = baseVariant(card.variants)
    refs.push({ cardId: card.id, lang, variant: base })
    if (!options.withVariants) continue
    for (const variant of card.variants) {
      if (variant !== base) refs.push({ cardId: card.id, lang, variant })
    }
  }

  if (options.withPromos) {
    for (const card of source.promos) {
      refs.push({ cardId: card.id, lang, variant: baseVariant(card.variants) })
    }
  }
  return refs
}

export function pagesNeeded(cardCount: number, layout: Layout): number {
  return Math.max(1, Math.ceil(cardCount / slotsPerPage(layout)))
}

export interface MasterSetBinderInput {
  name: string
  layout: Layout
  defaultOpeningSide: OpeningSide
  setId: string
  options: MasterSetOptions
}

/** A binder with one pocket per card, all of them still missing. */
export function createMasterSetBinder(
  input: MasterSetBinderInput,
  cards: readonly CardRef[],
  ctx: ModelContext = defaultContext,
): Binder {
  const binder = createBinder(
    {
      name: input.name,
      layout: input.layout,
      defaultOpeningSide: input.defaultOpeningSide,
      mode: 'masterSet',
      setId: input.setId,
      withReverseHolo: input.options.withVariants,
      withSecretRares: input.options.excludedSecretRarities.length === 0,
      withPromos: input.options.withPromos,
    },
    ctx,
  )
  const perPage = slotsPerPage(input.layout)
  const pages = Array.from({ length: pagesNeeded(cards.length, input.layout) }, (_, pageIndex) => {
    const page = createPage(input.layout, pageIndex, input.defaultOpeningSide, ctx)
    return {
      ...page,
      slots: page.slots.map((slot): Slot => {
        const cardRef = cards[pageIndex * perPage + slot.index]
        return cardRef ? { index: slot.index, cardRef, owned: false } : slot
      }),
    }
  })
  return { ...binder, pages }
}

/**
 * The promo set that goes with a set: TCGdex files promos per series (e.g. `svp` for all
 * Scarlet & Violet sets), not per set. `undefined` if the series has none.
 */
export function promoSetIdOf(catalog: Catalog, setId: string): string | undefined {
  const set = catalog.setsById.get(setId)
  if (!set) return undefined
  const promoSetId = `${set.seriesId}p`
  return promoSetId !== setId && catalog.setsById.has(promoSetId) ? promoSetId : undefined
}
